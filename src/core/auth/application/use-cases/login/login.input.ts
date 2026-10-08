import { IsEmail, IsNotEmpty, IsString, MaxLength } from "class-validator";

export class LoginInput {
  @IsEmail()
  @MaxLength(254)
  email: string;

  /**
   * Sem regra de complexidade: ela é de CRIAÇÃO de conta, não de autenticação.
   *
   * O teto existe por custo, não por regra de senha. O Keycloak faz hash
   * (PBKDF2) de tudo que recebe, então um corpo com 1 MB de "senha" é CPU do
   * provedor de identidade gasta de graça por requisição anônima. 128 folga
   * sobre os 72 do cadastro para não trancar conta criada pelo console.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
