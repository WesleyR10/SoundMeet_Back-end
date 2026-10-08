import { ContractSearchParams } from "../contract.repository";

/**
 * Regressão do override do setter `filter`.
 *
 * 🔴 O setter da classe base coage escalares a string (herança do FC3, onde
 * `Filter` é busca livre). Sem o override, um `Filter` que é objeto vira
 * `"[object Object]"`, o repositório monta `where: {}` e a rota devolve **os
 * contratos de todos os usuários** — com HTTP 200 e sem nenhum erro.
 *
 * Já aconteceu de verdade neste projeto em `repertoire` (vazamento ativo),
 * `transaction` e `musician-wallet` (latentes). Contrato tem CPF, CNPJ,
 * endereço e valor: é o pior lugar possível para repetir.
 */
describe("ContractSearchParams", () => {
  it("preserva o filtro como objeto", () => {
    const params = ContractSearchParams.create({
      filter: { establishment_id: "estab-1", status: "signed" },
    });

    expect(params.filter).toEqual({
      establishment_id: "estab-1",
      status: "signed",
    });
  });

  it("NÃO transforma o filtro em string", () => {
    const params = ContractSearchParams.create({
      filter: { booking_id: "booking-1" },
    });

    // O bug da classe base fazia `this._filter = `${value}``, ou seja, o
    // próprio filtro VIRAVA a string "[object Object]" — e aí o repositório
    // não achava campo nenhum para montar o `where`.
    expect(typeof params.filter).toBe("object");
    expect(params.filter).not.toBe("[object Object]");
    expect(params.filter?.booking_id).toBe("booking-1");
  });

  it("descarta campo fora da whitelist", () => {
    const params = ContractSearchParams.create({
      filter: {
        establishment_id: "estab-1",
        // @ts-expect-error — campo inexistente, simulando query manipulada
        content_hash: "qualquer",
      },
    });

    expect(params.filter).toEqual({ establishment_id: "estab-1" });
  });

  it("vira null quando não sobra nenhum campo válido", () => {
    const params = ContractSearchParams.create({
      // @ts-expect-error — só campo inexistente
      filter: { inexistente: "x" },
    });

    expect(params.filter).toBeNull();
  });

  it("aceita filtro ausente", () => {
    expect(ContractSearchParams.create().filter).toBeNull();
    expect(ContractSearchParams.create({ filter: null }).filter).toBeNull();
  });

  describe("participant_ids", () => {
    it("preserva o array sem coagir a string", () => {
      const params = ContractSearchParams.create({
        filter: { participant_ids: ["a", "b"] },
      });

      expect(params.filter?.participant_ids).toEqual(["a", "b"]);
    });

    /**
     * 🔴 A invariante que separa "sem filtro" de "nenhuma identidade".
     *
     * Um ator sem nenhuma identidade utilizável tem que receber ZERO linhas. Se
     * o array vazio caísse no truthy-check e sumisse do filtro, o repositório
     * montaria a consulta sem escopo — e devolveria os contratos de todos os
     * usuários para quem não deveria ver nenhum.
     */
    it("PRESERVA array vazio — ele significa zero resultados, não 'sem filtro'", () => {
      const params = ContractSearchParams.create({
        filter: { participant_ids: [] },
      });

      expect(params.filter).toEqual({ participant_ids: [] });
      expect(params.filter).not.toBeNull();
    });

    it("descarta entradas que não são string não vazia", () => {
      const params = ContractSearchParams.create({
        filter: {
          participant_ids: ["ok", "", null as any, 42 as any, "outro"],
        },
      });

      expect(params.filter?.participant_ids).toEqual(["ok", "outro"]);
    });

    it("convive com os demais campos", () => {
      const params = ContractSearchParams.create({
        filter: { participant_ids: ["a"], status: "issued" },
      });

      expect(params.filter).toEqual({
        participant_ids: ["a"],
        status: "issued",
      });
    });
  });
});
