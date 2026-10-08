import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  validateSync,
} from "class-validator";

import { IsExternalUrl } from "../../../../shared/application/validators/is-external-url.validator";
import {
  ESTABLISHMENT_TYPES,
  EstablishmentType,
} from "../create-establishment/create-establishment.input";

export type UpdateEstablishmentInputConstructorProps = {
  id: string;
  name?: string;
  description?: string;
  cnpj?: string;
  legal_representative_name?: string | null;
  legal_representative_document?: string | null;
  email?: string;
  phone?: string;
  website?: string;
  establishment_type?: EstablishmentType;
  is_active?: boolean;
};

export class UpdateEstablishmentInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  /*
   * 🔴 `avatar` SAIU daqui em 18/set/2026. Era texto livre de até 500
   * caracteres, sem nenhuma validação de URL, e a foto passou a ter porta
   * própria (`POST`/`DELETE /establishments/:id/avatar`) com par URL + chave.
   * Aceitar a URL também por aqui desligaria a chave do objeto que o upload
   * gravou — o arquivo ficaria órfão e pago, sem erro nenhum. Com
   * `forbidNonWhitelisted`, quem mandar `avatar` recebe 422 (nenhum cliente
   * manda: conferido no web e no mobile). Mesma postura da capa, que nunca
   * esteve neste input.
   */

  @IsString()
  @IsOptional()
  @MaxLength(18)
  cnpj?: string;

  /**
   * Nome de quem assina pela PJ. `null` limpa o representante.
   *
   * `ValidateIf` em vez de `IsOptional` porque `null` aqui é um comando
   * legítimo (trocou de sócio, quer apagar) e precisa passar sem validação de
   * string, enquanto string vazia não deve passar.
   */
  @ValidateIf((_o, value) => value !== null && value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  legal_representative_name?: string | null;

  /** CPF de quem assina pela PJ. Dígitos verificadores conferidos pelo VO. */
  @ValidateIf((_o, value) => value !== null && value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(14)
  legal_representative_document?: string | null;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  @IsExternalUrl()
  website?: string;

  @IsString()
  @IsOptional()
  @IsIn(ESTABLISHMENT_TYPES)
  @MaxLength(50)
  establishment_type?: EstablishmentType;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  constructor(props: UpdateEstablishmentInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.cnpj = props.cnpj;
    this.legal_representative_name = props.legal_representative_name;
    this.legal_representative_document = props.legal_representative_document;
    this.email = props.email;
    this.phone = props.phone;
    this.website = props.website;
    this.establishment_type = props.establishment_type;
    this.is_active = props.is_active;
  }
}

export class ValidateUpdateEstablishmentInput {
  static validate(input: UpdateEstablishmentInput) {
    return validateSync(input);
  }
}
