import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, MaxLength } from "class-validator";

/**
 * Corpo de `POST /auth/resend-verification`.
 *
 * 🔴 A resposta é sempre a mesma, exista ou não conta para este endereço — a
 * rota é `@Public()` e responder diferente a transformaria num verificador de
 * "quem tem cadastro no SoundMeet". Ver `VerifyEmailService.resend`.
 */
export class ResendVerificationDto {
  @ApiProperty({ format: "email" })
  @MaxLength(254)
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
