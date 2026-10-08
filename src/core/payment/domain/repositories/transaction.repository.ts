import { ISearchableRepository } from "../../../shared/domain/repository/repository-interface";
import { SearchParams } from "../../../shared/domain/repository/search-params";
import { SearchResult } from "../../../shared/domain/repository/search-result";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { Transaction } from "../transaction.aggregate";
import { TransactionStatus, TransactionType } from "../transaction-enums";

export type TransactionFilter = {
  user_id?: string;
  musician_id?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  start_date?: Date;
  end_date?: Date;
};

export class TransactionSearchParams extends SearchParams<TransactionFilter> {
  get filter(): TransactionFilter | null {
    return this._filter;
  }

  /**
   * Override obrigatório — o setter da classe base faz `${value}` e converte o
   * filtro-objeto em "[object Object]".
   *
   * Aqui o efeito seria vazamento de dado FINANCEIRO: `buildWhereClause` recebe
   * a string (truthy, então não cai no early-return), lê `filter.musician_id`
   * como undefined e monta `where: {}` — devolvendo as transações de todos os
   * músicos. Hoje `GetMusicianTransactionsUseCase` não está ligado a nenhuma
   * rota HTTP, então o vazamento é latente; corrigido antes de virar real
   * (29/jul/2026). Mesmo achado que derrubou o escopo de repertoire.
   */
  protected set filter(value: TransactionFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const dateFrom = (date: any): Date | null => {
      if (!date) return null;
      if (date instanceof Date) return date;
      const parsed = new Date(date);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const start_date = dateFrom(_value?.start_date);
    const end_date = dateFrom(_value?.end_date);

    const filter = {
      ...(_value?.musician_id && { musician_id: `${_value.musician_id}` }),
      ...(_value?.user_id && { user_id: `${_value.user_id}` }),
      ...(_value?.type && { type: _value.type }),
      ...(_value?.status && { status: _value.status }),
      ...(start_date && { start_date }),
      ...(end_date && { end_date }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class TransactionSearchResult extends SearchResult<Transaction> {}

export interface ITransactionRepository extends ISearchableRepository<
  Transaction,
  Uuid,
  TransactionFilter,
  TransactionSearchParams,
  TransactionSearchResult
> {
  findByMusicianId(musicianId: string): Promise<Transaction[]>;
  findByUserId(userId: string): Promise<Transaction[]>;
  findByExternalId(externalId: string): Promise<Transaction | null>;
  /**
   * Transação já criada para esta chave de idempotência **deste músico**.
   *
   * Primeira barreira do retry: quem repete a requisição com a mesma chave
   * recebe de volta a transação original em vez de um segundo saque. A
   * barreira definitiva é o UNIQUE da coluna — este `find` só evita o custo de
   * chegar até a violação no caso comum.
   *
   * 🔴 **`musicianId` é obrigatório, e é por isso que ele está na assinatura.**
   * A chave é escolhida pelo CLIENTE e o UNIQUE da coluna é global, então uma
   * busca só por `key` devolve a transação de QUALQUER músico que a tenha
   * usado. Duas consequências, ambas reais:
   *
   *  - o chamador recebia de volta `transaction_id` e `status` de outra pessoa;
   *  - se aquela transação estivesse `pending` sem `external_id`, o ramo de
   *    redespacho de `WithdrawToPixUseCase.dispatch` chegava a pedir a
   *    transferência ao provedor usando a **chave PIX de quem fez a chamada**.
   *
   * Não era alcançável na prática enquanto os clientes gerassem chave
   * aleatória — mas a defesa não pode depender disso. O escopo entra na
   * assinatura (e não numa composição de string na gravação) justamente para
   * que esquecê-lo seja erro de compilação, e não silêncio.
   */
  findByIdempotencyKey(
    key: string,
    musicianId: string,
  ): Promise<Transaction | null>;

  /**
   * Soma e contagem dos saques (`WITHDRAWAL`) do músico desde `since` — a base
   * do teto diário e do limite de velocidade (A1). Conta apenas `PENDING` e
   * `COMPLETED`: um saque `FAILED`/`REFUNDED` teve o valor devolvido à carteira
   * e não deve consumir a cota do dia. Contar o `PENDING` é o ponto — um saque
   * em curso já reservou a cota, e ignorá-lo deixaria dois saques grandes
   * simultâneos furarem o teto.
   *
   * 🔴 Chamado DENTRO da transação com o lock da carteira: fora dela, dois
   * saques concorrentes leriam a mesma soma antiga e os dois passariam.
   */
  sumWithdrawalsSince(
    musicianId: string,
    since: Date,
  ): Promise<{ total: number; count: number }>;
}
