import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

export class ShareChordSheetDto {
  @ApiProperty({
    enum: ["band", "community"],
    description:
      '"band" libera para os membros aceitos das bandas do músico; "community" publica para qualquer músico da plataforma (exige plano pago). "private" não é aceito aqui — use DELETE /share.',
  })
  @IsIn(["band", "community"])
  scope: "band" | "community";
}
