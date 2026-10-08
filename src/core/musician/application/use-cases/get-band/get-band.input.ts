import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export type GetBandInputConstructorProps = {
  id: string;
  requesting_musician_id?: string | null;
  is_admin?: boolean;
  rejected_token_sub?: string | null;
};

export class GetBandInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  // `sub` do JWT, quando a chamada veio autenticada. Decide a VISÃO.
  @IsUUID()
  @IsOptional()
  requesting_musician_id?: string | null;

  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;

  /**
   * `sub` de um token que o `AuthGuard` RECUSOU (rota pública com
   * autenticação opcional). 🔴 Não é identidade: o valor não foi verificado e
   * só serve para recusar mais — ver `GetBandUseCase`.
   */
  @IsString()
  @IsOptional()
  rejected_token_sub?: string | null;

  constructor(props: GetBandInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    this.requesting_musician_id = props.requesting_musician_id;
    this.is_admin = props.is_admin ?? false;
    this.rejected_token_sub = props.rejected_token_sub;
  }
}
