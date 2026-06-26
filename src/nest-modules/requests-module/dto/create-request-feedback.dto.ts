import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { CreateRequestFeedbackInput } from "../../../core/request/application/use-cases/create-request-feedback/create-request-feedback.input";

export class CreateRequestFeedbackDto extends CreateRequestFeedbackInput {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  declare rating: number;

  @ApiPropertyOptional({ example: "Músico incrível!" })
  declare comment?: string | null;
}
