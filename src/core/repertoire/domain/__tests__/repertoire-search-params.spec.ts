import { RepertoireSearchParams } from "../repertoire.repository";

/**
 * Regressão de vazamento entre músicos.
 *
 * O setter `filter` da classe base SearchParams faz `${value}`, o que converte
 * um filtro-objeto em "[object Object]". Quando isso acontece,
 * `params.filter?.musician_id` vira undefined, o repositório monta `where: {}`
 * e `GET /musicians/:id/repertoires` devolve os repertórios de TODOS os músicos
 * — o ownership guard autoriza o dono da URL, mas não escopa o resultado.
 *
 * Todo domínio que filtra por objeto sobrescreve o setter; este ficou de fora.
 */
describe("RepertoireSearchParams — escopo do filtro", () => {
  it("preserva o filtro-objeto em vez de stringificá-lo", () => {
    const params = RepertoireSearchParams.create({
      filter: { musician_id: "musician-1", name: null },
    });

    expect(params.filter).toEqual({ musician_id: "musician-1" });
  });

  it("mantém musician_id acessível para o repositório montar o where", () => {
    const params = RepertoireSearchParams.create({
      filter: { musician_id: "musician-1", name: null },
    });

    expect(params.filter?.musician_id).toBe("musician-1");
  });

  it("preserva o filtro por nome junto com o escopo do músico", () => {
    const params = RepertoireSearchParams.create({
      filter: { musician_id: "musician-1", name: "Setlist" },
    });

    expect(params.filter).toEqual({
      musician_id: "musician-1",
      name: "Setlist",
    });
  });

  it("filtro vazio vira null", () => {
    expect(RepertoireSearchParams.create({ filter: {} }).filter).toBeNull();
    expect(RepertoireSearchParams.create({}).filter).toBeNull();
  });
});
