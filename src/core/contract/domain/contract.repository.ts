import { ISearchableRepository } from "../../shared/domain/repository/repository-interface";
import {
  SearchParams as DefaultSearchParams,
  SearchParamsConstructorProps,
} from "../../shared/domain/repository/search-params";
import { SearchResult as DefaultSearchResult } from "../../shared/domain/repository/search-result";
import { Contract, ContractId } from "./contract.aggregate";
import { ContractStatus } from "./contract-types";

export type ContractFilter = {
  booking_id?: string | null;
  establishment_id?: string | null;
  musician_id?: string | null;
  band_id?: string | null;
  status?: ContractStatus | string | null;
  /**
   * Todas as identidades do ator (o `sub` mais os claims `establishment_ids` e
   * `band_ids`), casadas em **OR** contra os três lados possíveis.
   *
   * 🔴 Array vazio DEVE devolver zero linhas. Lista vazia nunca pode virar
   * "sem filtro" — isso entregaria os contratos de todos os usuários. Mesmo
   * cuidado documentado em `booking.repository.ts`, e mesma armadilha que já
   * vazou dados em `repertoire`, `transaction` e `musician-wallet`.
   */
  participant_ids?: string[] | null;
};

export class ContractSearchParams extends DefaultSearchParams<ContractFilter> {
  private constructor(
    props: SearchParamsConstructorProps<ContractFilter> = {},
  ) {
    super(props);
  }

  static create(props: SearchParamsConstructorProps<ContractFilter> = {}) {
    return new ContractSearchParams(props);
  }

  get filter(): ContractFilter | null {
    return this._filter;
  }

  /**
   * Override obrigatório: o setter da classe base coage escalares a string
   * (herança do FC3, onde `Filter` é busca livre). Sem isto o filtro é
   * descartado, o repositório monta `where: {}` e a listagem devolve **os
   * contratos de todos os usuários** — com HTTP 200 e sem nenhum erro.
   *
   * `participant_ids` fica **fora** da coerção: é array, e `${array}` viraria
   * uma string com vírgulas que jamais casaria com id nenhum.
   */
  protected set filter(value: ContractFilter | null) {
    const _value =
      !value || (value as unknown) === "" || typeof value !== "object"
        ? null
        : value;

    const participantIds = Array.isArray(_value?.participant_ids)
      ? _value.participant_ids.filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        )
      : undefined;

    const filter = {
      ...(_value &&
        _value.booking_id && { booking_id: `${_value.booking_id}` }),
      ...(_value &&
        _value.establishment_id && {
          establishment_id: `${_value.establishment_id}`,
        }),
      ...(_value &&
        _value.musician_id && { musician_id: `${_value.musician_id}` }),
      ...(_value && _value.band_id && { band_id: `${_value.band_id}` }),
      ...(_value && _value.status && { status: `${_value.status}` }),
      // Array vazio é preservado de propósito: significa "nenhuma identidade",
      // e tem que produzir zero resultados, não ausência de filtro.
      ...(participantIds !== undefined && { participant_ids: participantIds }),
    };

    this._filter = Object.keys(filter).length === 0 ? null : (filter as any);
  }
}

export class ContractSearchResult extends DefaultSearchResult<Contract> {}

export interface IContractRepository extends ISearchableRepository<
  Contract,
  ContractId,
  ContractFilter,
  ContractSearchParams,
  ContractSearchResult
> {
  /**
   * O contrato vigente de um booking — maior `revision` que não esteja anulado.
   *
   * É a consulta que torna a emissão idempotente: reentrega do
   * `BookingConfirmedEvent` encontra o contrato existente e vira no-op. A
   * garantia real, porém, é a unique `(bookingId, revision)` no banco — esta
   * consulta é conveniência, não a defesa. Mesmo desenho do
   * `findByAuthorAndContext` de `review`.
   */
  findCurrentByBookingId(booking_id: string): Promise<Contract | null>;

  /** Busca pelo código público de verificação. */
  findByVerificationCode(code: string): Promise<Contract | null>;
}
