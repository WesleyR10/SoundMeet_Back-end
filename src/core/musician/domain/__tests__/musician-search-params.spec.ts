import { MusicianSearchParams } from "../musician.repository";

/*
 * 🔴 Este setter é a última linha antes do repositório, e tudo que chega a ele
 * por HTTP é TEXTO. Os testes de repositório montam o filtro já tipado e por
 * isso nunca viram o defeito: até out/2026 `price_min`, `price_max`,
 * `is_active` e `is_verified` vindos da query string eram descartados em
 * silêncio, e a busca respondia 200 com a lista inteira.
 *
 * Aqui os valores entram como a query string os entrega.
 */
describe("MusicianSearchParams — filtro como a query string entrega", () => {
  const filterOf = (filter: Record<string, unknown>) =>
    MusicianSearchParams.create({ filter: filter as any }).filter;

  describe("preço", () => {
    it('converte "100" e "300" em número', () => {
      expect(filterOf({ price_min: "100", price_max: "300" })).toStrictEqual({
        price_min: 100,
        price_max: 300,
      });
    });

    it("mantém número que já é número, inclusive zero", () => {
      expect(filterOf({ price_min: 0, price_max: 250.5 })).toStrictEqual({
        price_min: 0,
        price_max: 250.5,
      });
    });

    it.each(["", "abc", null, undefined, "Infinity"])(
      "descarta %p em vez de virar zero ou NaN",
      (value) => {
        expect(filterOf({ price_min: value, name: "x" })).toStrictEqual({
          name: "x",
        });
      },
    );
  });

  describe("booleanos", () => {
    it.each([
      ["true", true],
      ["false", false],
      [true, true],
      [false, false],
    ])("is_active %p vira %p", (input, expected) => {
      expect(filterOf({ is_active: input })).toStrictEqual({
        is_active: expected,
      });
    });

    it('"false" NÃO vira true (o erro clássico de Boolean("false"))', () => {
      expect(filterOf({ is_verified: "false" })).toStrictEqual({
        is_verified: false,
      });
    });

    it.each(["1", "yes", "", null])("descarta %p", (value) => {
      expect(filterOf({ is_verified: value, name: "x" })).toStrictEqual({
        name: "x",
      });
    });
  });

  describe("listas", () => {
    it("texto solto vira lista de um (filter[genres]=MPB sem colchete)", () => {
      expect(filterOf({ genres: "MPB" })).toStrictEqual({ genres: ["MPB"] });
    });

    it("lista segue lista, sem vazios", () => {
      expect(filterOf({ instruments: ["Violão", " ", "Voz"] })).toStrictEqual({
        instruments: ["Violão", "Voz"],
      });
    });

    it("objeto (o que o qs devolve acima de 20 itens) é descartado, não repassado ao Prisma", () => {
      expect(
        filterOf({ genres: { 0: "MPB", 1: "Rock" }, name: "x" }),
      ).toStrictEqual({ name: "x" });
    });

    it("lista vazia de gêneros não vira filtro", () => {
      expect(filterOf({ genres: [], name: "x" })).toStrictEqual({ name: "x" });
    });

    it("`ids` vazio CONTINUA sendo filtro: é 'nenhum id', não 'sem filtro'", () => {
      expect(filterOf({ ids: [] })).toStrictEqual({ ids: [] });
    });
  });

  describe("busca pelo nome exibido", () => {
    it("guarda `q` aparado", () => {
      expect(filterOf({ q: "  carlão " })).toStrictEqual({ q: "carlão" });
    });

    it.each(["", "   ", null, 42])("descarta q %p", (value) => {
      expect(filterOf({ q: value })).toBeNull();
    });
  });

  describe("e-mail", () => {
    /*
     * A rota é pública e o presenter esconde o e-mail. Com `filter[email]`
     * fazendo `contains`, dava para reconstruir o e-mail de qualquer artista
     * letra a letra. O campo não existe mais no filtro.
     */
    it("não existe: é descartado, sozinho ou acompanhado", () => {
      expect(filterOf({ email: "musico5" })).toBeNull();
      expect(filterOf({ email: "musico5", name: "x" })).toStrictEqual({
        name: "x",
      });
    });
  });

  describe("raio", () => {
    it("o trio completo entra, convertido", () => {
      expect(
        filterOf({ lat: "-23.55", lng: "-46.63", radius_km: "10" }),
      ).toStrictEqual({ lat: -23.55, lng: -46.63, radius_km: 10 });
    });

    it("par nulo não vira a coordenada (0, 0)", () => {
      expect(filterOf({ lat: null, lng: null, radius_km: 10 })).toBeNull();
    });

    it("par sem raio fica como ORIGEM: dá distância, não filtra", () => {
      expect(filterOf({ lat: "-23.55", lng: "-46.63" })).toStrictEqual({
        lat: -23.55,
        lng: -46.63,
      });
    });

    it("metade do par é descartada, com ou sem raio", () => {
      expect(filterOf({ lat: "-23.55" })).toBeNull();
      expect(filterOf({ lng: "-46.63", radius_km: 10 })).toBeNull();
    });

    it("raio zero ou negativo não vira filtro; a origem fica", () => {
      expect(filterOf({ lat: 1, lng: 2, radius_km: 0 })).toStrictEqual({
        lat: 1,
        lng: 2,
      });
      expect(filterOf({ lat: 1, lng: 2, radius_km: -3 })).toStrictEqual({
        lat: 1,
        lng: 2,
      });
    });

    it("raio acima de 500 km é reduzido", () => {
      expect(filterOf({ lat: 1, lng: 2, radius_km: 9000 })).toStrictEqual({
        lat: 1,
        lng: 2,
        radius_km: 500,
      });
    });
  });

  describe("gate de consentimento", () => {
    it("createPublic força open_to_gigs mesmo se o chamador mandar false", () => {
      const params = MusicianSearchParams.createPublic({
        filter: { open_to_gigs: "false" } as any,
      });

      expect(params.filter).toStrictEqual({ open_to_gigs: true });
    });
  });
});
