import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class RefreshSessionInput {
  /**
   * Opaco para nós — quem valida é o Keycloak. O teto só impede que um corpo
   * gigante vire trabalho de parse do lado dele. Um refresh token offline do
   * realm tem ~1 KB.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(8192)
  refresh_token: string;
}
