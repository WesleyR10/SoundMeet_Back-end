import { IsNotEmpty, IsOptional, IsUUID } from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { Conversation } from "./conversation.aggregate";

export class ConversationRules {
  /**
   * A conversa nasce de UMA das duas portas da negociação: uma `Inquiry`
   * ("conversar sobre uma data") ou um `Booking` ("propor um show"). Por isso
   * os dois campos são opcionais AQUI — quem exige exatamente um é
   * `validateNegotiationOrigin`, logo abaixo, porque XOR entre dois campos não
   * cabe num decorator de campo.
   */
  @IsOptional({ groups: ["inquiry_id"] })
  @IsUUID("4", { groups: ["inquiry_id"] })
  inquiry_id: string | null;

  @IsOptional({ groups: ["booking_id"] })
  @IsUUID("4", { groups: ["booking_id"] })
  booking_id: string | null;

  @IsUUID("4", { groups: ["establishment_id"] })
  @IsNotEmpty({ groups: ["establishment_id"] })
  establishment_id: string;

  @IsOptional({ groups: ["musician_id"] })
  @IsUUID("4", { groups: ["musician_id"] })
  musician_id: string | null;

  @IsOptional({ groups: ["band_id"] })
  @IsUUID("4", { groups: ["band_id"] })
  band_id: string | null;

  constructor(entity: Conversation | any) {
    this.inquiry_id = entity?.inquiry_id ?? null;
    this.booking_id = entity?.booking_id ?? null;
    this.establishment_id = entity?.establishment_id;
    this.musician_id = entity?.musician_id;
    this.band_id = entity?.band_id;
  }
}

/**
 * Exatamente UMA das duas origens, nunca nenhuma e nunca as duas.
 *
 * 🔴 Não é redundância com a CHECK do banco
 * (`conversations_exactly_one_negotiation`): o agregado precisa recusar ANTES
 * do `insert`, senão o erro chega como violação de constraint do Postgres —
 * mensagem em inglês, sem campo, achatada pelo `GlobalExceptionFilter` num 500.
 * O banco é a última linha; esta é a primeira.
 *
 * Duas origens ao mesmo tempo seriam uma conversa com dois contextos e nenhuma
 * regra para decidir qual a UI mostra; nenhuma origem seria uma conversa órfã,
 * que ninguém sabe de onde veio nem para onde volta.
 *
 * ⚠️ Fica fora do `ClassValidatorFields` de propósito. Os decorators do
 * class-validator validam UM campo por vez, e `fields` naquele validador vira
 * `groups` (ver a nota do `CLAUDE.md` da raiz) — um grupo que olhasse dois
 * campos não existe.
 */
export function validateNegotiationOrigin(
  notification: Notification,
  data: { inquiry_id: string | null; booking_id: string | null },
): void {
  const hasInquiry = data.inquiry_id !== null && data.inquiry_id !== undefined;
  const hasBooking = data.booking_id !== null && data.booking_id !== undefined;

  if (hasInquiry === hasBooking) {
    notification.addError(
      hasInquiry
        ? "Conversation cannot belong to an inquiry and a booking at the same time"
        : "Conversation must belong to either an inquiry or a booking",
      "negotiation_origin",
    );
  }
}

export class ConversationValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : [
          "inquiry_id",
          "booking_id",
          "establishment_id",
          "musician_id",
          "band_id",
        ];
    return super.validate(notification, new ConversationRules(data), newFields);
  }
}

export class ConversationValidatorFactory {
  static create(): ConversationValidator {
    return new ConversationValidator();
  }
}
