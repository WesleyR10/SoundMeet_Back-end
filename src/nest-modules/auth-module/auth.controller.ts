import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";

import { VerifyEmailService } from "./verify-email.service";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly verifyEmailService: VerifyEmailService) {}

  @Get("verify-email")
  @ApiOperation({ summary: "Confirma email via token enviado por email" })
  @ApiQuery({ name: "token", required: true, description: "Token UUID recebido no email" })
  @ApiResponse({ status: 200, description: "Email verificado com sucesso" })
  @ApiResponse({ status: 400, description: "Token expirado" })
  @ApiResponse({ status: 404, description: "Token inválido" })
  async verifyEmail(@Query("token") token: string): Promise<{ message: string }> {
    return this.verifyEmailService.verify(token);
  }
}
