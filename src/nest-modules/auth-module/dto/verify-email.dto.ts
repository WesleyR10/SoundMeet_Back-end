import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

/**
 * Corpo de `POST /auth/verify-email`.
 *
 * O token viaja no CORPO, não na query, porque esta é a rota que CONSUMA — e
 * um token de uso único em query string acaba em log de acesso, no Referer e no
 * histórico do navegador. A query continua servindo à rota irmã de consulta,
 * que não consome nada.
 */
export class VerifyEmailDto {
  @ApiProperty({ description: "Token recebido no e-mail de verificação." })
  @MaxLength(200)
  @IsString()
  @IsNotEmpty()
  token: string;
}
