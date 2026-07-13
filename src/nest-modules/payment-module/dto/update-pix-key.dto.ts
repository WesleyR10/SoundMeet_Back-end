import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class UpdatePixKeyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pix_key: string;

  @ApiProperty({ enum: ["cpf", "cnpj", "email", "phone", "random"] })
  @IsIn(["cpf", "cnpj", "email", "phone", "random"])
  pix_key_type: string;
}
