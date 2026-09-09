import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { AddEventPerformerDto } from "../add-event-performer.dto";
import { CreateEventDto } from "../create-event.dto";
import { UpdateEventDto } from "../update-event.dto";

/**
 * Regressão do 422 que tornava o módulo de eventos inalcançável por HTTP.
 *
 * O ValidationPipe global (`nest-modules/global-config.ts`) usa
 * `transform: true` mas NÃO `enableImplicitConversion`. Sem `@Type(() => Date)`
 * ao lado de `@IsDate()`, a data do corpo JSON permanece string e o pipe
 * responde 422 "start_at must be a Date instance" — antes de o use case rodar.
 *
 * Verificado por HTTP em 08/ago/2026, contra o container real: `POST
 * /establishments/:id/events` recusava TODO corpo válido, ainda que o agregado,
 * o use case e o repositório estivessem completos e testados. Os testes
 * unitários existentes não pegavam porque montam o input com `new Date()` em
 * memória, pulando a fronteira HTTP inteira.
 *
 * Mesmo bug do GET /gamification/leaderboard (roadmap 7.17). Este arquivo
 * existe para que a terceira ocorrência falhe no CI, não em produção.
 */
async function validateDto(
  cls: new () => object,
  payload: Record<string, unknown>,
) {
  return validate(plainToInstance(cls, payload));
}

const START_ISO = "2026-08-15T22:00:00.000Z";
const END_ISO = "2026-08-16T02:00:00.000Z";

describe("Coerção de data nos DTOs de evento (fronteira HTTP)", () => {
  describe("CreateEventDto", () => {
    it("aceita datas em ISO 8601, como chegam no corpo JSON", async () => {
      const errors = await validateDto(CreateEventDto, {
        name: "Sexta Autoral",
        start_at: START_ISO,
        end_at: END_ISO,
      });
      expect(errors).toHaveLength(0);
    });

    it("converte a string para Date de verdade — o use case recebe Date", () => {
      const dto = plainToInstance(CreateEventDto, {
        name: "Sexta Autoral",
        start_at: START_ISO,
        end_at: END_ISO,
      });

      expect(dto.start_at).toBeInstanceOf(Date);
      expect(dto.start_at.toISOString()).toBe(START_ISO);
      expect(dto.end_at).toBeInstanceOf(Date);
    });

    it("continua rejeitando data inválida (a coerção não afrouxa a validação)", async () => {
      const errors = await validateDto(CreateEventDto, {
        name: "Sexta Autoral",
        start_at: "não é data",
        end_at: END_ISO,
      });

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe("start_at");
    });
  });

  describe("UpdateEventDto", () => {
    it("aceita ISO 8601 e mantém a escrita parcial (só um campo)", async () => {
      const errors = await validateDto(UpdateEventDto, { start_at: START_ISO });
      expect(errors).toHaveLength(0);
    });

    it("aceita corpo vazio — todo campo é opcional no PATCH", async () => {
      expect(await validateDto(UpdateEventDto, {})).toHaveLength(0);
    });
  });

  describe("AddEventPerformerDto", () => {
    it("aceita o horário do set em ISO 8601", async () => {
      const errors = await validateDto(AddEventPerformerDto, {
        musician_id: "0b3a3f5e-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
        start_at: START_ISO,
        end_at: END_ISO,
      });
      expect(errors).toHaveLength(0);
    });

    it("aceita performer sem horário próprio (herda o do evento)", async () => {
      const errors = await validateDto(AddEventPerformerDto, {
        musician_id: "0b3a3f5e-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
      });
      expect(errors).toHaveLength(0);
    });
  });
});
