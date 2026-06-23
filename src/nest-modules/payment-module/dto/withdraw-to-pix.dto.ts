import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsString, Min, ValidateNested } from "class-validator";

export class WithdrawPixKeyDto {
  @ApiProperty()
  @IsString()
  key: string;

  @ApiProperty()
  @IsString()
  type: string;
}

export class WithdrawToPixDto {
  @ApiProperty({ minimum: 1 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ type: WithdrawPixKeyDto })
  @ValidateNested()
  @Type(() => WithdrawPixKeyDto)
  pix_key: WithdrawPixKeyDto;
}
