import { OmitType } from "@nestjs/mapped-types";
import { ApiProperty } from "@nestjs/swagger";

import { DisputeBookingInput } from "../../../core/scheduling/application/use-cases/dispute-booking/dispute-booking.input";

/**
 * Contestação da apresentação.
 *
 * Padrão do projeto: o DTO estende o Input do core e usa `OmitType` para
 * remover o que vem da rota ou do JWT — campo de identidade nunca vem do corpo.
 */
export class DisputeBookingDto extends OmitType(DisputeBookingInput, [
  "booking_id",
  "requesting_participant_ids",
  "is_admin",
] as const) {
  @ApiProperty({
    description:
      "Por que a apresentação está sendo contestada. Obrigatório — é o que a mediação lê, e contestação sem motivo trava dinheiro sem ninguém conseguir dizer por quê.",
    maxLength: 1000,
    example: "A banda tocou 40 minutos, e o combinado eram 2 horas.",
  })
  declare reason: string;
}
