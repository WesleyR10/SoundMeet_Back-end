import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";

import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../../../global-config";
import { SearchMusiciansDto } from "../search-musicians.dto";

/*
 * O pipe é o de PRODUÇÃO (`GLOBAL_VALIDATION_PIPE_OPTIONS`), e os valores
 * entram como o `qs` os entrega: tudo texto, lista só quando veio com `[]`.
 * Montar o DTO com objeto já tipado testaria uma fronteira que não existe —
 * foi assim que o filtro de preço passou meses sem filtrar.
 */
const pipe = new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS);
const metadata: ArgumentMetadata = {
  type: "query",
  metatype: SearchMusiciansDto,
  data: "",
};

const parse = (query: Record<string, unknown>) =>
  pipe.transform(query, metadata) as Promise<SearchMusiciansDto>;

const messagesOf = async (
  query: Record<string, unknown>,
): Promise<string[]> => {
  try {
    await parse(query);
    return [];
  } catch (error: any) {
    expect(error.getStatus()).toBe(422);
    return error.getResponse().message as string[];
  }
};

describe("SearchMusiciansDto — o filtro da busca pública", () => {
  it("aceita o que o web manda, convertendo preço e raio", async () => {
    const dto = await parse({
      page: "2",
      per_page: "20",
      sort: "rating",
      sort_dir: "desc",
      filter: {
        q: "carlão",
        genres: ["MPB", "Jazz"],
        instruments: ["Piano"],
        price_model: "per_hour",
        price_min: "100",
        price_max: "300",
        lat: "-23.55",
        lng: "-46.63",
        radius_km: "10",
      },
    });

    expect(dto.page).toBe(2);
    expect(dto.filter).toMatchObject({
      q: "carlão",
      genres: ["MPB", "Jazz"],
      price_model: "per_hour",
      price_min: 100,
      price_max: 300,
      lat: -23.55,
      lng: -46.63,
      radius_km: 10,
    });
  });

  it("aceita o que o app manda", async () => {
    const dto = await parse({
      per_page: "20",
      filter: { stage_name: "bia", genres: ["Samba"] },
    });

    expect(dto.filter).toMatchObject({ stage_name: "bia", genres: ["Samba"] });
  });

  it("sem filtro nenhum é válido", async () => {
    await expect(parse({})).resolves.toBeDefined();
  });

  it("gênero como texto solto vira lista de um (respondia 500)", async () => {
    const dto = await parse({ filter: { genres: "MPB" } });

    expect(dto.filter!.genres).toStrictEqual(["MPB"]);
  });

  it('"false" em is_verified vira false, não true', async () => {
    const dto = await parse({ filter: { is_verified: "false" } });

    expect(dto.filter!.is_verified).toBe(false);
  });

  /*
   * 🔴 Chave fora da allowlist é 422, como já era no topo da query. Antes o
   * filtro aceitava qualquer chave calado — inclusive as de uso interno.
   */
  it.each([
    ["email", "musico5", "reconstruía o e-mail de qualquer artista"],
    ["ids", ["9366b7dc-2d71-4799-b91c-c64adb205104"], "é da faixa em destaque"],
    ["is_active", "false", "é forçado pelo use-case"],
    ["open_to_gigs", "false", "é o gate de consentimento"],
    ["foo", "1", "não existe"],
  ])("recusa filter[%s]=%p (%s)", async (key, value, _reason) => {
    const messages = await messagesOf({ filter: { [key]: value } });

    expect(messages.join(" ")).toContain(`property ${key} should not exist`);
  });

  it.each([
    ["price_min", "abc"],
    ["price_min", "-1"],
    ["price_max", "Infinity"],
    ["lat", "91"],
    ["lng", "-181"],
    ["radius_km", "-5"],
    ["price_model", "per_song"],
    ["price_currency", "BTC"],
    ["is_verified", "talvez"],
  ])("recusa filter[%s]=%s", async (key, value) => {
    expect(await messagesOf({ filter: { [key]: value } })).not.toHaveLength(0);
  });

  it("recusa mais de 20 gêneros (o teto em que o qs deixa de devolver lista)", async () => {
    const genres = Array.from({ length: 21 }, (_, index) => `g${index}`);

    expect(await messagesOf({ filter: { genres } })).not.toHaveLength(0);
  });

  it("recusa lista que o qs devolveu como objeto", async () => {
    expect(
      await messagesOf({ filter: { genres: { 0: "MPB", 1: "Rock" } } }),
    ).not.toHaveLength(0);
  });

  it("recusa filter que não é objeto", async () => {
    expect(await messagesOf({ filter: "abc" })).not.toHaveLength(0);
  });

  it("recusa texto de busca gigante", async () => {
    expect(
      await messagesOf({ filter: { q: "a".repeat(101) } }),
    ).not.toHaveLength(0);
  });
});
