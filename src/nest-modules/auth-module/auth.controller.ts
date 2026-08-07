import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { AddRoleOutput } from "../../core/auth/application/use-cases/add-role/add-role.output";
import { AddRoleUseCase } from "../../core/auth/application/use-cases/add-role/add-role.use-case";
import { LoginOutput } from "../../core/auth/application/use-cases/login/login.output";
import { LoginUseCase } from "../../core/auth/application/use-cases/login/login.use-case";
import { RegisterOutput } from "../../core/auth/application/use-cases/register/register.output";
import { RegisterUseCase } from "../../core/auth/application/use-cases/register/register.use-case";
import { RegisterEstablishmentOutput } from "../../core/auth/application/use-cases/register-establishment/register-establishment.output";
import { RegisterEstablishmentUseCase } from "../../core/auth/application/use-cases/register-establishment/register-establishment.use-case";
import { SocialSignupOutput } from "../../core/auth/application/use-cases/social-signup/social-signup.output";
import { SocialSignupUseCase } from "../../core/auth/application/use-cases/social-signup/social-signup.use-case";
import { Public } from "./auth.decorators";
import { AuthGuard } from "./auth.guard";
import { CurrentUserContextGuard } from "./current-user-context.guard";
import { CurrentUser } from "./decorators/current-user.decorator";
import { AddRoleDto } from "./dto/add-role.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { RegisterEstablishmentDto } from "./dto/register-establishment.dto";
import { SocialSignupDto } from "./dto/social-signup.dto";
import { AuthenticatedUser } from "./interfaces/authenticated-user.interface";
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
    private readonly registerEstablishmentUseCase: RegisterEstablishmentUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly socialSignupUseCase: SocialSignupUseCase,
    private readonly addRoleUseCase: AddRoleUseCase,
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

  @Post("register-establishment")
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary: "Registro de novo estabelecimento",
    description:
      "Cria a conta no Keycloak com a role `establishment`, cria o aggregate Establishment (UUID próprio), vincula a conta ao estabelecimento pelo claim `establishment_ids` e retorna tokens via Direct Access Grants. Rota separada de POST /auth/register porque o modelo de posse é diferente: músico e público têm `aggregate_id == sub`, estabelecimento não — uma conta pode operar até 3 unidades. IMPORTANTE: o cliente deve fazer refresh do token antes da primeira chamada protegida por EstablishmentOwnershipGuard (o campo `needs_token_refresh` sinaliza isso), porque o claim só entra no próximo token emitido.",
  })
  @ApiResponse({
    status: 201,
    description: "Conta e estabelecimento criados, tokens retornados",
  })
  @ApiResponse({ status: 409, description: "Email ou CNPJ já cadastrado" })
  @ApiResponse({ status: 422, description: "Dados inválidos" })
  @ApiResponse({
    status: 503,
    description: "Provedor de identidade indisponível",
  })
  async registerEstablishment(
    @Body() dto: RegisterEstablishmentDto,
  ): Promise<RegisterEstablishmentOutput> {
    return this.registerEstablishmentUseCase.execute(dto);
  }

  @Post("login")
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({
    summary: "Login por email e senha",
    description:
      "Autentica via Direct Access Grants no Keycloak e resolve o papel/perfil do usuário nos aggregates locais.",
  })
  @ApiResponse({
    status: 200,
    description: "Login efetuado, tokens retornados",
  })
  @ApiResponse({ status: 401, description: "Credenciais inválidas" })
  @ApiResponse({ status: 422, description: "Dados inválidos" })
  @ApiResponse({
    status: 503,
    description: "Provedor de identidade indisponível",
  })
  async login(@Body() dto: LoginDto): Promise<LoginOutput> {
    return this.loginUseCase.execute(dto);
  }

  @Post("social-signup")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({
    summary: "Completa cadastro de usuário autenticado via provedor social",
    description:
      "Para usuários já autenticados no Keycloak via login social (ex.: Google) mas sem role/aggregate local ainda. Atribui o papel escolhido e cria o aggregate mínimo (músico ou público) usando o mesmo id do token (sub).",
  })
  @ApiResponse({ status: 201, description: "Cadastro completado" })
  @ApiResponse({ status: 409, description: "Usuário já cadastrado" })
  @ApiResponse({ status: 422, description: "Dados inválidos" })
  @ApiResponse({
    status: 503,
    description: "Provedor de identidade indisponível",
  })
  async socialSignup(
    @Body() dto: SocialSignupDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SocialSignupOutput> {
    return this.socialSignupUseCase.execute({
      user_id: user.userId,
      existing_roles: user.roles,
      role: dto.role,
      cpf: dto.cpf,
      phone: dto.phone,
    });
  }

  @Post("add-role")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({
    summary: "Adiciona um segundo papel ao usuário autenticado",
    description:
      "Multi-role (mobile 10.5): usuário já cadastrado com um papel (músico ou fã) adiciona o outro — atribui a role no Keycloak e cria o aggregate que falta com o mesmo id do token. O app deve fazer token refresh silencioso em seguida para a nova role entrar no JWT.",
  })
  @ApiResponse({ status: 201, description: "Papel adicionado" })
  @ApiResponse({ status: 409, description: "Usuário já possui este papel" })
  @ApiResponse({ status: 422, description: "Dados inválidos" })
  @ApiResponse({
    status: 503,
    description: "Provedor de identidade indisponível",
  })
  async addRole(
    @Body() dto: AddRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AddRoleOutput> {
    return this.addRoleUseCase.execute({
      user_id: user.userId,
      existing_roles: user.roles,
      role: dto.role,
      cpf: dto.cpf,
      phone: dto.phone,
    });
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
