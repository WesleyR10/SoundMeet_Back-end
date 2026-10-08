import { ISearchableRepository } from "../../../shared/domain/repository/repository-interface";
import { SearchParams } from "../../../shared/domain/repository/search-params";
import { SearchResult } from "../../../shared/domain/repository/search-result";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { MusicianWallet } from "../musician-wallet.aggregate";

export type MusicianWalletFilter = {
  musician_id?: string;
  is_active?: boolean;
};

export class MusicianWalletSearchParams extends SearchParams<MusicianWalletFilter> {
  get filter(): MusicianWalletFilter | null {
    return this._filter;
  }

  /**
   * Override obrigatório — o setter da classe base faz `${value}` e converte o
   * filtro-objeto em "[object Object]", descartando o escopo por músico.
   * Ainda não há chamador desta busca; corrigido junto com transaction e
   * repertoire (29/jul/2026) para não nascer vazando.
   */
  protected set filter(value: MusicianWalletFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const filter = {
      ...(_value?.musician_id && { musician_id: `${_value.musician_id}` }),
      ...(typeof _value?.is_active === "boolean" && {
        is_active: _value.is_active,
      }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : filter;
  }
}

export class MusicianWalletSearchResult extends SearchResult<MusicianWallet> {}

export interface IMusicianWalletRepository extends ISearchableRepository<
  MusicianWallet,
  Uuid,
  MusicianWalletFilter,
  MusicianWalletSearchParams,
  MusicianWalletSearchResult
> {
  findByMusicianId(musicianId: string): Promise<MusicianWallet | null>;
  /**
   * A carteira do músico, com a linha TRAVADA até o fim da transação corrente.
   *
   * 🔴 É o que serializa dois saques simultâneos. Sem o lock, as duas execuções
   * leem o mesmo saldo, as duas passam pela checagem de fundos do agregado, as
   * duas mandam transferência real ao provedor — e a segunda escrita sobrescreve
   * a primeira, deixando UM débito para DOIS pagamentos. O saldo lido depois do
   * lock é necessariamente o saldo já debitado pelo concorrente, então a
   * invariante de `withdrawFunds` volta a valer.
   *
   * Só faz sentido dentro de uma transação: fora dela o banco libera o lock ao
   * fim do próprio SELECT, e o chamador fica com a garantia aparente sem a
   * garantia real. Por isso a implementação Prisma **recusa** ser chamada fora
   * de uma `UnitOfWork` ativa, em vez de degradar em silêncio.
   */
  findByMusicianIdForUpdate(musicianId: string): Promise<MusicianWallet | null>;
  /**
   * Carteiras com vínculo Mercado Pago vencendo até `before` — a varredura do
   * job de renovação.
   *
   * Deixar um token vencer custa uma reautorização MANUAL do músico, que é
   * exatamente a fricção que o `offline_access` existe para evitar. Por isso a
   * busca é por vencimento, e a folga é generosa.
   */
  findMercadoPagoExpiring(
    before: Date,
    limit: number,
  ): Promise<MusicianWallet[]>;
  /**
   * Carteira pelo id da conta no Mercado Pago.
   *
   * É como o webhook descobre de quem é o pagamento: a notificação traz o
   * `user_id` do vendedor e só o id da cobrança — o valor e a metadata vêm de
   * consultar a API **com o token dele**.
   */
  findByMercadoPagoUserId(mpUserId: string): Promise<MusicianWallet | null>;
}
