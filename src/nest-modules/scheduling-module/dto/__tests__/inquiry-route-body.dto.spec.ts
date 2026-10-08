import { ValidationPipe } from "@nestjs/common";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { RouteParamtypes } from "@nestjs/common/enums/route-paramtypes.enum";

import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../../../global-config";
import { InquiriesController } from "../../inquiries.controller";
import { ConvertInquiryToBookingDto } from "../convert-inquiry-to-booking.dto";
import { RejectInquiryDto } from "../reject-inquiry.dto";

/**
 * 🔴 O `inquiry_id` vem da URL (`:id`), e o DTO do CORPO o exigia (30/set/2026).
 *
 * Os três DTOs faziam `extends` do Input do core sem `OmitType` — e o Input
 * declara `inquiry_id` com `@IsUUID()`/`@IsNotEmpty()`. O controller nunca lia
 * o campo do corpo (monta o input com o `:id`), mas o pipe roda ANTES do
 * handler: todo corpo legítimo levava 422 *"inquiry_id must be a UUID,
 * inquiry_id should not be empty, inquiry_id must be a string"*.
 *
 * Sintoma no app: "Tenho interesse" e "Recusar" no bilhete do chat nunca
 * funcionaram — o erro aparecia cru no cartão. No web, a casa não conseguia
 * transformar a conversa em proposta.
 *
 * Os corpos abaixo são os que os clientes REALMENTE mandam
 * (`soundmeet-mobile/.../inquiry.api.ts`, `soundmeet-web/.../propose-booking.validation.ts`),
 * contra o pipe de produção — não uma cópia das opções.
 */
const pipe = new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS);

describe("Rotas de inquiry — o corpo não carrega o id da URL", () => {
  it("accept não lê corpo nenhum (igual ao `confirm` do booking)", () => {
    const args = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      InquiriesController,
      "accept",
    ) as Record<string, unknown>;

    const bodyArgs = Object.keys(args).filter(
      (key) => Number(key.split(":")[0]) === RouteParamtypes.BODY,
    );
    expect(bodyArgs).toEqual([]);
  });

  it("reject aceita o corpo do app: só `reason`", async () => {
    await expect(
      pipe.transform(
        { reason: "Já tenho show nessa data" },
        { type: "body", metatype: RejectInquiryDto },
      ),
    ).resolves.toMatchObject({ reason: "Já tenho show nessa data" });
  });

  it("reject aceita motivo nulo (o app manda `null` quando vazio)", async () => {
    await expect(
      pipe.transform({ reason: null }, { type: "body", metatype: RejectInquiryDto }),
    ).resolves.toBeDefined();
  });

  it("convert aceita o corpo do web: data + cachê, sem inquiry_id", async () => {
    await expect(
      pipe.transform(
        {
          start_at: "2026-10-10T22:00:00.000Z",
          end_at: "2026-10-11T02:00:00.000Z",
          fee: 900,
        },
        { type: "body", metatype: ConvertInquiryToBookingDto },
      ),
    ).resolves.toMatchObject({ fee: 900 });
  });

  it.each([
    ["RejectInquiryDto", RejectInquiryDto, {}],
    [
      "ConvertInquiryToBookingDto",
      ConvertInquiryToBookingDto,
      {
        start_at: "2026-10-10T22:00:00.000Z",
        end_at: "2026-10-11T02:00:00.000Z",
        fee: 900,
      },
    ],
  ] as const)(
    "%s recusa identidade vinda do corpo (id da rota e ator são do servidor)",
    async (_nome, metatype, base) => {
      for (const campo of [
        { inquiry_id: "44444444-4444-4444-8444-444444444444" },
        { requesting_participant_ids: ["11111111-1111-4111-8111-111111111111"] },
        { requesting_musician_id: "11111111-1111-4111-8111-111111111111" },
        { is_admin: true },
      ]) {
        await expect(
          pipe.transform({ ...base, ...campo }, { type: "body", metatype }),
        ).rejects.toMatchObject({ status: 422 });
      }
    },
  );
});
