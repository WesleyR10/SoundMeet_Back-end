import { IsEmail, MaxLength } from "class-validator";

export class RequestPasswordResetInput {
  @IsEmail()
  @MaxLength(254)
  email: string;
}
