import { IsBoolean, IsNotEmpty, IsOptional, IsUUID, validateSync } from "class-validator";

export type GetRequestInputConstructorProps = {
  id: string;
  requesting_user_id?: string;
  is_admin?: boolean;
};

export class GetRequestInput {
  @IsUUID()
  @IsNotEmpty()
  id: string;

  // Id do usuário autenticado (audience_id, musician_id OU establishment_id
  // — checado contra os três no use-case, já que um mesmo Keycloak `sub`
  // pode ter múltiplos papéis). undefined só ocorre em chamada não
  // autenticada, o que a rota já impede via guards.
  @IsUUID()
  @IsOptional()
  requesting_user_id?: string;

  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;

  constructor(props: GetRequestInputConstructorProps) {
    if (!props) return;

    this.id = props.id;
    this.requesting_user_id = props.requesting_user_id;
    this.is_admin = props.is_admin;
  }
}

export class ValidateGetRequestInput {
  static validate(input: GetRequestInput) {
    return validateSync(input);
  }
}
