import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { RegisterOutput } from "../../core/auth/application/use-cases/register/register.output";
import { RegisterUseCase } from "../../core/auth/application/use-cases/register/register.use-case";
import { Public } from "./auth.decorators";
import { AuthGuard } from "./auth.guard";
import { CurrentUserContextGuard } from "./current-user-context.guard";
import { RegisterDto } from "./dto/register.dto";
import { RolesGuard } from "./roles.guard";
import { VerifyEmailService } from "./verify-email.service";

@ApiTags("Auth")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("auth")
export class AuthController {
  constructor(
    private readonly verifyEmailService: VerifyEmailService,
    private readonly registerUseCase: RegisterUseCase,
  ) {}

  @Post("register")
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary: "Registro de novo usuário",
    description:
      "Cria a conta no Keycloak, cria o aggregate mínimo (músico ou público) e retorna tokens via Direct Access Grants. Única porta de entrada para novos usuários, já que registrationAllowed permanece false no realm.",
  })
  @ApiResponse({ status: 201, description: "Conta criada, tokens retornados" })
  @ApiResponse({ status: 409, description: "Email já cadastrado" })
  @ApiResponse({ status: 422, description: "Dados inválidos" })
  @ApiResponse({
    status: 503,
    description: "Provedor de identidade indisponível",
  })
  async register(@Body() dto: RegisterDto): Promise<RegisterOutput> {
    return this.registerUseCase.execute(dto);
  }

  @Get("verify-email")
  @Public()
  @ApiOperation({ summary: "Confirma email via token enviado por email" })
  @ApiQuery({
    name: "token",
    required: true,
    description: "Token UUID recebido no email",
  })
  @ApiResponse({ status: 200, description: "Email verificado com sucesso" })
  @ApiResponse({ status: 400, description: "Token expirado" })
  @ApiResponse({ status: 404, description: "Token inválido" })
  async verifyEmail(
    @Query("token") token: string,
  ): Promise<{ message: string }> {
    return this.verifyEmailService.verify(token);
  }
}
