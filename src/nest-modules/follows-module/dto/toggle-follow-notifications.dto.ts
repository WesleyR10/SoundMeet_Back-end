import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class ToggleFollowNotificationsDto {
  @ApiProperty({
    description: "Liga/desliga os avisos deste vínculo sem desfazê-lo.",
  })
  @IsBoolean()
  enabled: boolean;
}
