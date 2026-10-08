import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

import {
  ESTABLISHMENT_TYPES,
  EstablishmentType,
} from "../../../../establishment/application/use-cases/create-establishment/create-establishment.input";

export class RegisterEstablishmentInput {
  /** Nome do estabelecimento — é ele que vira `Establishment.name`. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9]).+$/, {
    message: "A senha deve conter ao menos uma letra maiúscula e um número",
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(ESTABLISHMENT_TYPES)
  establishment_type: EstablishmentType;

  // Opcional no cadastro: o agregado valida só `name`/`email`/
  // `establishment_type`, e exigir CNPJ na porta de entrada barraria bar
  // pequeno/MEI em processo de abertura. Quando vier, é único (Bloco 9.1).
  @IsString()
  @IsOptional()
  @MaxLength(18)
  cnpj?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  website?: string;

  /**
   * Nome da pessoa que abre a conta. Vai para o usuário do provedor de
   * identidade, não para o agregado — o `Establishment.name` é o do
   * estabelecimento. Ausente, cai no nome do estabelecimento.
   */
  @IsString()
  @IsOptional()
  @MaxLength(120)
  owner_name?: string;
}
