import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";

import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../../../global-config";
import { SearchBandsDto } from "../search-bands.dto";

/*
 * O pipe é o de PRODUÇÃO (`GLOBAL_VALIDATION_PIPE_OPTIONS`), e os valores
 * entram como o `qs` os entrega: tudo texto, lista só quando veio com `[]`.
 * Montar o DTO com objeto já tipado testaria uma fronteira que não existe —
 * foi assim que o filtro de preço da aba Bandas passou meses sem filtrar.
 */
const pipe = new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS);
const metadata: ArgumentMetadata = {
  type: "query",
  metatype: SearchBandsDto,
  data: "",
};

const parse = (query: Record<string, unknown>) =>
  pipe.transform(query, metadata) as Promise<SearchBandsDto>;

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

describe("SearchBandsDto — o filtro da busca pública de bandas", () => {
  it("aceita o que o web manda, convertendo preço e raio de texto para número", async () => {
    const dto = await parse({
      page: "2",
      per_page: "20",
      sort: "name",
      sort_dir: "asc",
      filter: {
        name: "trio",
        genres: ["MPB", "Jazz"],
        price_model: "per_event",
        price_min: "800",
        price_max: "1500",
        lat: "-23.55",
        lng: "-46.63",
        radius_km: "10",
      },
    });

    expect(dto.page).toBe(2);
    expect(dto.filter).toEqual({
      name: "trio",
      genres: ["MPB", "Jazz"],
      price_model: "per_event",
      // 🔴 Número, não "800": como texto o setter do domínio os descartava e
      // a busca devolvia todas as bandas.
      price_min: 800,
      price_max: 1500,
      lat: -23.55,
      lng: -46.63,
      radius_km: 10,
    });
  });

  it("🔴 `filter[genres]=MPB` (sem colchete) vira lista de um — antes era 500", async () => {
    const dto = await parse({ filter: { genres: "MPB" } });

    expect(dto.filter?.genres).toEqual(["MPB"]);
  });

  describe("🔴 allowlist: o filtro interno não é alcançável por HTTP", () => {
    it.each([
      // Listava as bandas de qualquer músico, mesmo fora do radar.
      ["musician_id", "03187da7-5db6-41d7-8ee7-1b11d0db463b"],
      // Quem decide são os use-cases (`BandSearchParams.createPublic`).
      ["open_to_gigs", "false"],
      ["is_active", "false"],
      ["banana", "1"],
    ])("recusa filter[%s]", async (key, value) => {
      const messages = await messagesOf({ filter: { [key]: value } });

      expect(messages.join(" ")).toContain(key);
    });
  });

  it("recusa preço que não é número, em vez de ignorar", async () => {
    const messages = await messagesOf({ filter: { price_min: "barato" } });

    expect(messages.join(" ")).toContain("price_min");
  });

  it("recusa `filter` que não é objeto", async () => {
    expect(await messagesOf({ filter: "abc" })).not.toEqual([]);
  });

  it("busca sem filtro continua válida", async () => {
    const dto = await parse({});

    expect(dto.filter).toBeUndefined();
  });

  it("recusa coordenada fora da faixa", async () => {
    const messages = await messagesOf({
      filter: { lat: "95", lng: "-46.63", radius_km: "10" },
    });

    expect(messages.join(" ")).toContain("lat");
  });
});
