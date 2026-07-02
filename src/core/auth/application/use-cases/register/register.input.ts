import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
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
}
