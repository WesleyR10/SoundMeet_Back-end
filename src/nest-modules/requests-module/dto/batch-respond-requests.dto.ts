import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

import { BATCH_RESPOND_MAX_ITEMS } from "../../../core/request/application/use-cases/batch-respond-to-requests/batch-respond-to-requests.use-case";
import { RespondToRequestAction } from "../../../core/request/application/use-cases/respond-to-request/respond-to-request.input";

/**
 * `musician_id` NÃO entra aqui: vem do JWT no controller. Aceitá-lo pelo corpo
 * permitiria responder pedidos de outro músico.
 */
export class BatchRespondRequestsDto {
  @ApiProperty({
    type: [String],
    format: "uuid",
    maxItems: BATCH_RESPOND_MAX_ITEMS,
    description:
      "IDs dos pedidos. Duplicatas são ignoradas. Teto protege o servidor de um lote arbitrário numa rota autenticada.",
  })
  @IsUUID("all", { each: true })
  @ArrayMaxSize(BATCH_RESPOND_MAX_ITEMS)
  @ArrayMinSize(1)
  @IsArray()
  request_ids: string[];

  @ApiProperty({ enum: RespondToRequestAction })
  @IsEnum(RespondToRequestAction)
  action: RespondToRequestAction;

  @ApiPropertyOptional({ maxLength: 500 })
  @MaxLength(500)
  @IsString()
  @IsOptional()
  rejection_reason?: string;
}
