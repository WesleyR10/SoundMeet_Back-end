import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

import { UpdateEventMusicianStatusAction } from "../../../core/events/application/use-cases/update-event-musician-status/update-event-musician-status.use-case";

export class UpdateEventMusicianStatusDto {
  @ApiProperty({ enum: ["confirm", "cancel"] })
  @IsIn(["confirm", "cancel"])
  action: UpdateEventMusicianStatusAction;
}
