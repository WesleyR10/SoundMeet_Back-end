import { IsIn, IsNotEmpty, IsString, ValidateIf } from "class-validator";

import { SocialSignupRole } from "../../../core/auth/application/use-cases/social-signup/social-signup.input";

export class SocialSignupDto {
  @IsIn(["musician", "audience"])
  role: SocialSignupRole;

  // Obrigatórios só para role=musician (anti multi-conta), mesma regra do registro por senha.
  @ValidateIf((o: SocialSignupDto) => o.role === "musician")
  @IsNotEmpty({ message: "CPF é obrigatório para músicos" })
  @IsString()
  cpf?: string;

  @ValidateIf((o: SocialSignupDto) => o.role === "musician")
  @IsNotEmpty({ message: "Celular é obrigatório para músicos" })
  @IsString()
  phone?: string;
}
