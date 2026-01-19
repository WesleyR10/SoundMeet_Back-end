import { IsNotEmpty, IsString } from "class-validator";

export class AddEventAttendeeDto {
  @IsString()
  @IsNotEmpty()
  audience_id: string;
}
