import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from "class-validator";

export type TransferBandLeadershipInputConstructorProps = {
  band_id: string;
  new_leader_musician_id: string;
  requesting_musician_id?: string | null;
  is_admin?: boolean;
};

export class TransferBandLeadershipInput {
  @IsUUID()
  @IsNotEmpty()
  band_id: string;

  @IsUUID()
  @IsNotEmpty()
  new_leader_musician_id: string;

  // `sub` do JWT. Só o líder atual transfere — quem pede vem do token, nunca
  // do corpo, senão qualquer membro se autodeclararia líder de saída.
  @IsUUID()
  @IsOptional()
  requesting_musician_id?: string | null;

  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;

  constructor(props: TransferBandLeadershipInputConstructorProps) {
    if (!props) return;
    this.band_id = props.band_id;
    this.new_leader_musician_id = props.new_leader_musician_id;
    this.requesting_musician_id = props.requesting_musician_id;
    this.is_admin = props.is_admin ?? false;
  }
}
