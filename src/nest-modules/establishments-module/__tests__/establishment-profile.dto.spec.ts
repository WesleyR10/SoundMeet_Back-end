import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";

import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../../global-config";
import { CreateEstablishmentProfileDto } from "../dto/create-establishment-profile.dto";
import { UpdateEstablishmentProfileDto } from "../dto/update-establishment-profile.dto";

/**
 * A fronteira HTTP, e não o use case.
 *
 * O `ValidationPipe` global roda com `whitelist: true` (`global-config.ts`), que
 * **remove do body em silêncio** qualquer propriedade sem decorator no DTO — sem
 * erro, sem log. O efeito é a tela dizer "salvo" sem ter salvo nada. Foi assim
 * que três bugs sobreviveram a 2876 testes verdes (roadmap 9.7): os testes de
 * use case montam o input já pronto e nunca atravessam o pipe.
 *
 * Estes testes usam o pipe de produção — `GLOBAL_VALIDATION_PIPE_OPTIONS`,
 * o MESMO objeto que `applyGlobalConfig` passa ao `useGlobalPipes`, e não uma
 * cópia das opções. A cópia era o defeito: quando o INP-1 ligou
 * `forbidNonWhitelisted` na produção, esta spec continuou com a config antiga e
 * seguiu verde descrevendo um comportamento que a produção não tinha mais.
 * Se um campo novo for adicionado ao input do core sem decorator, ou se a
 * classe aninhada perder o `@Type()`, eles quebram aqui — não em produção.
 */
const pipe = new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS);

const updateMeta: ArgumentMetadata = {
  type: "body",
  metatype: UpdateEstablishmentProfileDto,
};

const createMeta: ArgumentMetadata = {
  type: "body",
  metatype: CreateEstablishmentProfileDto,
};

const validLocation = {
  street: "Av. Paulista",
  number: "1000",
  neighborhood: "Bela Vista",
  city: "São Paulo",
  state: "SP",
  zipCode: "01310-100",
};

const fullStageTechSpec = {
  hasPa: true,
  mixerChannels: 12,
  monitors: 2,
  hasMicrophones: 4,
  backline: ["Bateria", "Cubo de guitarra"],
  dimensions: { widthM: 5, depthM: 3, heightM: 2.5 },
  power: { outlets: 6, voltage: "110V/220V" },
  hasParking: true,
  hasSoundEngineer: false,
  soundcheckWindow: "18:00-19:00",
  notes: "Palco no fundo do salão",
};

describe("Establishment profile DTOs — HTTP boundary", () => {
  describe("stageTechSpec survives the whitelist", () => {
    it("should keep every field on update", async () => {
      const result = await pipe.transform(
        { stageTechSpec: fullStageTechSpec },
        updateMeta,
      );

      expect(result.stageTechSpec).toEqual(fullStageTechSpec);
    });

    it("should keep every field on create", async () => {
      const result = await pipe.transform(
        { location: validLocation, stageTechSpec: fullStageTechSpec },
        createMeta,
      );

      expect(result.stageTechSpec).toEqual(fullStageTechSpec);
    });

    // As subestruturas só sobrevivem por causa do @Type() — sem ele o
    // whitelist as esvazia, e o erro apareceria como "perdi as dimensões".
    it("should keep the nested dimensions and power subestructures", async () => {
      const result = await pipe.transform(
        {
          stageTechSpec: {
            dimensions: { widthM: 5, depthM: 3 },
            power: { outlets: 4, voltage: "220V" },
          },
        },
        updateMeta,
      );

      expect(result.stageTechSpec.dimensions).toEqual({ widthM: 5, depthM: 3 });
      expect(result.stageTechSpec.power).toEqual({
        outlets: 4,
        voltage: "220V",
      });
    });

    /*
     * INP-1: antes isto era um strip silencioso (`{ widthM: 5 }`, request 200).
     * `forbidNonWhitelisted` propaga para o objeto aninhado, então a tentativa
     * agora aparece — que é o ponto inteiro do item: a defesa não mudou, a
     * OBSERVABILIDADE mudou.
     */
    it("should reject an unknown key inside the nested subestructure with 422", async () => {
      await expect(
        pipe.transform(
          { stageTechSpec: { dimensions: { widthM: 5, hackedField: "x" } } },
          updateMeta,
        ),
      ).rejects.toMatchObject({ status: 422 });
    });

    it("should accept a partial spec", async () => {
      const result = await pipe.transform(
        { stageTechSpec: { hasPa: true } },
        updateMeta,
      );

      expect(result.stageTechSpec).toEqual({ hasPa: true });
    });

    // null é "limpa a ficha"; undefined é "não mexe". Os use cases dependem
    // dessa distinção chegar intacta.
    it("should preserve an explicit null", async () => {
      const result = await pipe.transform({ stageTechSpec: null }, updateMeta);

      expect(result.stageTechSpec).toBeNull();
    });

    it("should leave the field absent when it is not sent", async () => {
      const result = await pipe.transform({ capacity: 300 }, updateMeta);

      expect(result.stageTechSpec).toBeUndefined();
      expect("stageTechSpec" in result).toBe(false);
    });
  });

  describe("stageTechSpec rejects malformed input at the boundary", () => {
    it.each([
      ["a non-boolean hasPa", { hasPa: "sim" }],
      ["a non-integer mixerChannels", { mixerChannels: 2.5 }],
      ["a negative monitors", { monitors: -1 }],
      ["a non-array backline", { backline: "Bateria" }],
      ["a non-string backline item", { backline: [42] }],
      ["a non-numeric dimension", { dimensions: { widthM: "grande" } }],
      ["a non-numeric outlets", { power: { outlets: "muitas" } }],
    ])("should reject %s with 422", async (_label, stageTechSpec) => {
      await expect(
        pipe.transform({ stageTechSpec }, updateMeta),
      ).rejects.toMatchObject({ status: 422 });
    });
  });
});
