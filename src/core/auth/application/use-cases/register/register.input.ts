import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export type RegisterRole = "musician" | "audience";

export class RegisterInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
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

  @IsIn(["musician", "audience"])
  role: RegisterRole;

  // Obrigatórios só para role=musician (anti multi-conta); audience é público
  // casual escaneando QR — fricção extra aqui mataria conversão sem ganho real.
  @ValidateIf((o: RegisterInput) => o.role === "musician")
  @IsNotEmpty({ message: "CPF é obrigatório para músicos" })
  @IsString()
  cpf?: string;

  @ValidateIf((o: RegisterInput) => o.role === "musician")
  @IsNotEmpty({ message: "Celular é obrigatório para músicos" })
  @IsString()
  phone?: string;
}
