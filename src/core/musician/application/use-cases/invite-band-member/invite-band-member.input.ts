import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export type InviteBandMemberInputConstructorProps = {
  band_id: string;
  musician_id: string;
  instrument: string;
  requesting_musician_id?: string | null;
  is_admin?: boolean;
};

/**
 * 🔴 Sem `role`, e é de propósito (out/2026).
 *
 * O convite aceitava `role: "leader" | "member"` e o app oferecia os dois num
 * seletor. Só que toda banda nasce com um líder aceito, e o agregado recusa um
 * segundo — então "convidar como líder" respondia 422 SEMPRE. A opção existia
 * na tela e nunca funcionou.
 *
 * Convite é sempre para integrante. Quem passa a liderar é decidido por
 * `PATCH /bands/:id/leadership`, entre quem já está na banda.
 */
export class InviteBandMemberInput {
  @IsString()
  @IsNotEmpty()
  band_id: string;

  @IsUUID()
  @IsNotEmpty()
  musician_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  instrument: string;

  // `sub` do JWT — só o líder atual convida.
  @IsUUID()
  @IsOptional()
  requesting_musician_id?: string | null;

  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;

  constructor(props: InviteBandMemberInputConstructorProps) {
    if (!props) return;
    this.band_id = props.band_id;
    this.musician_id = props.musician_id;
    this.instrument = props.instrument;
    this.requesting_musician_id = props.requesting_musician_id;
    this.is_admin = props.is_admin ?? false;
  }
}
