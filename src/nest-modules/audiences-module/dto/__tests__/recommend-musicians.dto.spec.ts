import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";

import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../../../global-config";
import { RecommendMusiciansDto } from "../recommend-musicians.dto";

/**
 * 🔴 A rota do carrossel "Pra você" da Home do fã, na FRONTEIRA HTTP.
 *
 * `RecommendMusiciansDto` não tinha nenhum decorator de validação porque
 * `implements <tipo>` não carrega metadata para o runtime — só `extends` de
 * classe carrega. Consequência em duas fases:
 *
 *  - com `whitelist` sozinho, os cinco parâmetros eram descartados em silêncio
 *    e a paginação/o `only_active` desta rota **nunca funcionaram**;
 *  - com `forbidNonWhitelisted` (INP-1), o descarte virou **422** e o carrossel
 *    parou de carregar, porque `useRecommendedMusicians` manda `page`,
 *    `per_page` e `only_active` em toda chamada.
 *
 * O pipe aqui é o de produção (`GLOBAL_VALIDATION_PIPE_OPTIONS`). Um teste que
 * montasse o próprio pipe não teria pegado nem uma fase nem a outra.
 */
const pipe = new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS);
const META: ArgumentMetadata = {
  type: "query",
  metatype: RecommendMusiciansDto,
};

describe("RecommendMusiciansDto (fronteira HTTP)", () => {
  it("🔴 aceita a query EXATA que o app manda, e os valores CHEGAM ao handler", async () => {
    // `getRecommendedMusicians` em soundmeet-mobile:
    // params: { page, per_page: perPage, only_active: true }
    // A query string entrega tudo como texto — daí os @Transform.
    const result = await pipe.transform(
      { page: "1", per_page: "10", only_active: "true" },
      META,
    );

    expect(result).toEqual({ page: 1, per_page: 10, only_active: true });
  });

  it("aceita a query vazia (todos opcionais)", async () => {
    await expect(pipe.transform({}, META)).resolves.toEqual({});
  });

  it("converte os números em vez de repassar texto", async () => {
    const result = await pipe.transform({ page: "3", per_page: "25" }, META);

    expect(result.page).toBe(3);
    expect(result.per_page).toBe(25);
  });

  it.each([
    ["only_active=false", { only_active: "false" }, { only_active: false }],
    [
      "ordenação válida",
      { sort: "rating", sort_dir: "desc" },
      { sort: "rating", sort_dir: "desc" },
    ],
  ])("aceita %s", async (_rotulo, query, esperado) => {
    await expect(pipe.transform(query, META)).resolves.toEqual(esperado);
  });

  it.each([
    ["page zero", { page: "0" }],
    ["per_page acima do teto", { per_page: "500" }],
    ["sort fora do enum", { sort: "cachê" }],
    ["sort_dir fora do enum", { sort_dir: "ASCENDING" }],
    // O alarme do INP-1 continua valendo para o que NÃO é do contrato.
    ["parâmetro desconhecido", { is_admin: "true" }],
  ])("recusa %s com 422", async (_rotulo, query) => {
    await expect(pipe.transform(query, META)).rejects.toMatchObject({
      status: 422,
    });
  });
});
