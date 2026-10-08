import { BookingSearchParams } from "../booking.repository";
import { InquirySearchParams } from "../inquiry.repository";

/**
 * Regressão da armadilha registrada no CLAUDE.md: o setter de `filter` da
 * classe base coage escalares a string. `participant_ids` é ARRAY — se passar
 * por essa coerção vira "id-a,id-b" e nunca casa; se for descartado, o
 * repositório monta `where: {}` e devolve os dados de TODOS os usuários.
 * Já aconteceu em `repertoire`, `transaction` e `musician-wallet`.
 */
describe("SearchParams — participant_ids (Bloco 9.2)", () => {
  describe.each([
    ["BookingSearchParams", BookingSearchParams],
    ["InquirySearchParams", InquirySearchParams],
  ])("%s", (_name, SearchParams: any) => {
    it("preserva o array sem coagir para string", () => {
      const ids = [
        "3f1e2d4c-5b6a-4c7d-8e9f-0a1b2c3d4e5f",
        "b6a1f0c2-7d34-4e58-9a10-2f3c4d5e6f70",
      ];

      const params = SearchParams.create({ filter: { participant_ids: ids } });

      expect(Array.isArray(params.filter!.participant_ids)).toBe(true);
      expect(params.filter!.participant_ids).toEqual(ids);
    });

    // O ponto crítico: array vazio NÃO pode virar `filter: null`, senão o
    // repositório passa a não filtrar nada e vaza a base inteira.
    it("preserva array vazio em vez de descartar o filtro", () => {
      const params = SearchParams.create({ filter: { participant_ids: [] } });

      expect(params.filter).not.toBeNull();
      expect(params.filter!.participant_ids).toEqual([]);
    });

    it("descarta ids falsy sem perder os válidos", () => {
      const params = SearchParams.create({
        filter: {
          participant_ids: [
            "",
            null,
            undefined,
            "3f1e2d4c-5b6a-4c7d-8e9f-0a1b2c3d4e5f",
          ],
        },
      });

      expect(params.filter!.participant_ids).toEqual([
        "3f1e2d4c-5b6a-4c7d-8e9f-0a1b2c3d4e5f",
      ]);
    });

    it("combina com os demais filtros em vez de sobrescrevê-los", () => {
      const params = SearchParams.create({
        filter: {
          status: "confirmed",
          participant_ids: ["3f1e2d4c-5b6a-4c7d-8e9f-0a1b2c3d4e5f"],
        },
      });

      expect(params.filter!.status).toBe("confirmed");
      expect(params.filter!.participant_ids).toHaveLength(1);
    });

    it("filtro ausente continua sendo null (sem escopo)", () => {
      const params = SearchParams.create({});
      expect(params.filter).toBeNull();
    });
  });
});
