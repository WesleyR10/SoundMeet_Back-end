import { IsIn, IsNotEmpty, IsString, ValidateIf } from "class-validator";

import { AddRoleRole } from "../../../core/auth/application/use-cases/add-role/add-role.input";

export class AddRoleDto {
  @IsIn(["musician", "audience"])
  role: AddRoleRole;

  // Obrigatórios só para role=musician (anti multi-conta), mesma regra do
  // registro por senha e do social-signup.
  @ValidateIf((o: AddRoleDto) => o.role === "musician")
  @IsNotEmpty({ message: "CPF é obrigatório para músicos" })
  @IsString()
  cpf?: string;

  @ValidateIf((o: AddRoleDto) => o.role === "musician")
  @IsNotEmpty({ message: "Celular é obrigatório para músicos" })
  @IsString()
  phone?: string;
}
