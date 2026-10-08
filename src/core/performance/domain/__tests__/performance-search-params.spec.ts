import { PerformanceSearchParams } from "../performance.repository";

/**
 * Teste de REGRESSÃO da armadilha mais cara já registrada neste projeto.
 *
 * O setter de `filter` na classe base coage escalares a string (herança do FC3,
 * onde `Filter` é busca livre). Sem o override na subclasse o filtro vira
 * `"[object Object]"` ou é descartado, o repositório monta `where: {}` e a
 * listagem devolve os sets de TODOS os músicos — o vazamento que aconteceu em
 * `repertoire` em jul/2026.
 */
describe("PerformanceSearchParams.filter", () => {
  it("preserva o objeto de filtro em vez de coagir a string", () => {
    const params = PerformanceSearchParams.create({
      filter: { musician_id: "m-1", establishment_id: "e-1" },
    });

    expect(params.filter).toEqual({
      musician_id: "m-1",
      establishment_id: "e-1",
    });
    expect(typeof params.filter).toBe("object");
  });

  it("descarta chaves fora da whitelist", () => {
    const params = PerformanceSearchParams.create({
      filter: { musician_id: "m-1", hack: "1 OR 1=1" } as any,
    });

    expect(params.filter).toEqual({ musician_id: "m-1" });
    expect((params.filter as any).hack).toBeUndefined();
  });

  it("filtro vazio vira null — e o repositório trata null como 'sem filtro'", () => {
    expect(PerformanceSearchParams.create({ filter: {} }).filter).toBeNull();
    expect(PerformanceSearchParams.create({}).filter).toBeNull();
  });

  it("aceita os cinco campos declarados", () => {
    const params = PerformanceSearchParams.create({
      filter: {
        musician_id: "m",
        band_id: "b",
        establishment_id: "e",
        event_id: "ev",
        status: "ended",
      },
    });

    expect(params.filter).toEqual({
      musician_id: "m",
      band_id: "b",
      establishment_id: "e",
      event_id: "ev",
      status: "ended",
    });
  });

  it("string solta não vira filtro (o caso que a base coagiria)", () => {
    const params = PerformanceSearchParams.create({
      filter: "qualquer" as any,
    });
    expect(params.filter).toBeNull();
  });
});
