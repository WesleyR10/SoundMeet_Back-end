import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  validateSync,
} from "class-validator";

export type GetRequestInputConstructorProps = {
  id: string;
  requesting_participant_ids?: string[] | null;
  is_admin?: boolean;
};

export class GetRequestInput {
  @IsUUID()
  @IsNotEmpty()
  id: string;

  // Identidades do autenticado: `sub` (fã/músico) + claims `establishment_ids`.
  // Um id só não serve — o estabelecimento tem UUID próprio, distinto do `sub`,
  // então comparar o `sub` contra `event.establishment_id` nunca casava e a
  // conta de estabelecimento levava 403 no pedido do próprio evento.
  // Preenchido pelo controller a partir do JWT; ausente só em chamada interna,
  // o que a rota já impede via guards.
  @IsUUID("4", { each: true })
  @IsOptional()
  requesting_participant_ids?: string[] | null;

  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;

  constructor(props: GetRequestInputConstructorProps) {
    if (!props) return;

    this.id = props.id;
    this.requesting_participant_ids = props.requesting_participant_ids;
    this.is_admin = props.is_admin;
  }
}

export class ValidateGetRequestInput {
  static validate(input: GetRequestInput) {
    return validateSync(input);
  }
}
