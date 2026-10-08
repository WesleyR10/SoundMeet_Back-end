import { BookingEscrowStatus } from "../../booking-escrow-enums";
import { BookingEscrowSearchParams } from "../booking-escrow.repository";
import { MusicianWalletSearchParams } from "../musician-wallet.repository";
import { TransactionSearchParams } from "../transaction.repository";

/**
 * Regressão de vazamento financeiro.
 *
 * O setter `filter` da classe base SearchParams faz `${value}`, transformando um
 * filtro-objeto em "[object Object]". No caminho das transações isso é
 * especialmente perigoso: `buildWhereClause` faz `if (!filter) return {}` — a
 * string é truthy, então passa — depois lê `filter.musician_id` como undefined e
 * monta `where: {}`, devolvendo as transações de TODOS os músicos.
 */
describe("TransactionSearchParams — escopo do filtro", () => {
  it("preserva o filtro-objeto em vez de stringificá-lo", () => {
    const params = new TransactionSearchParams({
      filter: { musician_id: "musician-1", status: "completed" as never },
    });

    expect(params.filter).toEqual({
      musician_id: "musician-1",
      status: "completed",
    });
  });

  it("mantém musician_id acessível — é o que escopa o where", () => {
    const params = new TransactionSearchParams({
      filter: { musician_id: "musician-1" },
    });

    expect(params.filter?.musician_id).toBe("musician-1");
  });

  it("descarta campos indefinidos sem perder os preenchidos", () => {
    const params = new TransactionSearchParams({
      filter: {
        musician_id: "musician-1",
        status: undefined as never,
        type: undefined as never,
      },
    });

    expect(params.filter).toEqual({ musician_id: "musician-1" });
  });

  it("normaliza datas vindas como string", () => {
    const params = new TransactionSearchParams({
      filter: {
        musician_id: "m-1",
        start_date: "2026-01-01T00:00:00.000Z" as never,
      },
    });

    expect(params.filter?.start_date).toBeInstanceOf(Date);
  });

  it("ignora data inválida em vez de propagar NaN para o where", () => {
    const params = new TransactionSearchParams({
      filter: { musician_id: "m-1", start_date: "não é data" as never },
    });

    expect(params.filter).toEqual({ musician_id: "m-1" });
  });

  it("filtro vazio vira null", () => {
    expect(new TransactionSearchParams({ filter: {} }).filter).toBeNull();
    expect(new TransactionSearchParams({}).filter).toBeNull();
  });

  /**
   * Reproduz o predicado exato do TransactionPrismaRepository.buildWhereClause:
   * é ele que decide se a consulta é escopada ou aberta.
   */
  it("produz um where escopado ao músico, não um where vazio", () => {
    const params = new TransactionSearchParams({
      filter: { musician_id: "musician-1" },
    });

    const filter = params.filter;
    const where: Record<string, unknown> = {};
    if (filter) {
      if (filter.musician_id) where.musicianId = filter.musician_id;
      if (filter.user_id) where.userId = filter.user_id;
    }

    expect(where).toEqual({ musicianId: "musician-1" });
    expect(Object.keys(where).length).toBeGreaterThan(0);
  });
});

describe("MusicianWalletSearchParams — escopo do filtro", () => {
  it("preserva o filtro-objeto", () => {
    const params = new MusicianWalletSearchParams({
      filter: { musician_id: "musician-1", is_active: true },
    });

    expect(params.filter).toEqual({
      musician_id: "musician-1",
      is_active: true,
    });
  });

  it("preserva is_active false — booleano falso não é ausência de filtro", () => {
    const params = new MusicianWalletSearchParams({
      filter: { musician_id: "m-1", is_active: false },
    });

    expect(params.filter?.is_active).toBe(false);
  });

  it("filtro vazio vira null", () => {
    expect(new MusicianWalletSearchParams({ filter: {} }).filter).toBeNull();
  });
});

/**
 * Mesma armadilha, no lugar onde ela custa mais caro.
 *
 * Sem o override, `buildWhereClause` recebe `"[object Object]"` (truthy, então
 * passa pelo early-return), lê `filter.musician_id` como `undefined` e monta
 * `where: {}` — devolvendo a **custódia de todos os músicos**: valor de cachê,
 * comissão e a referência da cobrança no provedor.
 */
describe("BookingEscrowSearchParams — escopo do filtro", () => {
  it("preserva o filtro-objeto em vez de stringificá-lo", () => {
    const params = new BookingEscrowSearchParams({
      filter: {
        musician_id: "musician-1",
        status: BookingEscrowStatus.HELD,
      },
    });

    expect(params.filter).toEqual({
      musician_id: "musician-1",
      status: BookingEscrowStatus.HELD,
    });
  });

  it("mantém musician_id acessível — é o que escopa o where", () => {
    const params = new BookingEscrowSearchParams({
      filter: { musician_id: "musician-1" },
    });

    expect(params.filter?.musician_id).toBe("musician-1");
  });

  it("descarta campos indefinidos sem perder os preenchidos", () => {
    const params = new BookingEscrowSearchParams({
      filter: {
        musician_id: "musician-1",
        booking_id: undefined,
        status: undefined,
      },
    });

    expect(params.filter).toEqual({ musician_id: "musician-1" });
  });

  it("filtro vazio ou não-objeto vira null, e não uma string truthy", () => {
    expect(new BookingEscrowSearchParams({ filter: {} }).filter).toBeNull();
    expect(
      new BookingEscrowSearchParams({ filter: "" as never }).filter,
    ).toBeNull();
    expect(
      new BookingEscrowSearchParams({ filter: "qualquer" as never }).filter,
    ).toBeNull();
  });
});
