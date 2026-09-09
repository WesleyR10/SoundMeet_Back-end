import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
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
import type { Response } from "express";

import { AddRoleOutput } from "../../core/auth/application/use-cases/add-role/add-role.output";
import { AddRoleUseCase } from "../../core/auth/application/use-cases/add-role/add-role.use-case";
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
import { RegisterDto } from "./dto/register.dto";
import { RegisterEstablishmentDto } from "./dto/register-establishment.dto";
import { ResendVerificationDto } from "./dto/resend-verification.dto";
import { SocialSignupDto } from "./dto/social-signup.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
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
    private readonly socialSignupUseCase: SocialSignupUseCase,
    private readonly addRoleUseCase: AddRoleUseCase,
  ) {}

  @Post("register")
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary: "Registro de novo usuário",
    description:
      "Cria a conta no Keycloak, cria o aggregate mínimo (músico ou público) e já devolve a sessão. Única porta de entrada para novos usuários, já que registrationAllowed permanece false no realm. AUTH-1: os tokens saem de um grant de senha no client CONFIDENCIAL `soundmeet-registration` (secret só no backend), não no client público `soundmeet-mobile`, que desde 31/ago/2026 tem `directAccessGrantsEnabled: false`. O grant continua existindo aqui porque o usuário acabou de escolher a senha — mandá-lo à tela de login em seguida seria pedir para digitar duas vezes. Para LOGIN não há rota: é Authorization Code + PKCE direto no Keycloak.",
  })
  @ApiResponse({
    status: 201,
    description: "Conta criada, sessão retornada (ver a descrição acima)",
  })
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
      "Cria a conta no Keycloak com a role `establishment`, cria o aggregate Establishment (UUID próprio) e vincula a conta ao estabelecimento pelo claim `establishment_ids`. Rota separada de POST /auth/register porque o modelo de posse é diferente: músico e público têm `aggregate_id == sub`, estabelecimento não — uma conta pode operar até 3 unidades. 🔴 AUTH-1: esta rota NÃO devolve tokens (nem `needs_token_refresh`), e a ausência é a feature — o único chamador (`soundmeet-web`) já os descartava, porque o refresh token nascia vinculado a outro client e o access token nascia sem o claim `establishment_ids`, escrito depois da emissão. Quem cadastra segue para /api/auth/login (Authorization Code + PKCE) e o primeiro token dele já nasce completo.",
  })
  @ApiResponse({
    status: 201,
    description:
      "Conta e estabelecimento criados. Responde só `establishment_id`; a sessão nasce no login PKCE.",
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

  /**
   * Consulta o token SEM consumi-lo. É o que a página `/verificar-email` do web
   * chama ao abrir.
   *
   * 🔴 Rota estática declarada ANTES da irmã `@Get("verify-email")` por
   * disciplina de ordem — o mesmo cuidado de `GET /events/live` e
   * `GET /establishments/:id/events/active`.
   */
  @Get("verify-email/status")
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @ApiOperation({
    summary: "Consulta a validade do token de verificação (não consome)",
    description:
      "Leitura pura. Existe para que scanners de link de e-mail (Gmail, Outlook Safe Links, antivírus) façam prefetch sem queimar o token de uso único — a confirmação é POST.",
  })
  @ApiQuery({ name: "token", required: true })
  @ApiResponse({ status: 200, description: "valid | expired | invalid" })
  async verifyEmailStatus(@Query("token") token: string) {
    return this.verifyEmailService.peek(token);
  }

  /**
   * Confirma o e-mail. É POST porque MUTA — e porque um GET que muta é
   * consumido por prefetch de scanner antes do usuário clicar.
   */
  @Post("verify-email")
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: "Confirma o e-mail a partir do token" })
  @ApiResponse({ status: 200, description: "Email verificado com sucesso" })
  @ApiResponse({ status: 400, description: "Token expirado" })
  @ApiResponse({ status: 404, description: "Token inválido" })
  async confirmEmail(
    @Body() dto: VerifyEmailDto,
  ): Promise<{ message: string }> {
    return this.verifyEmailService.verify(dto.token);
  }

  /**
   * Reenvia o link. Sem isto, token perdido ou expirado (TTL de 24h, uso único)
   * é beco sem saída: não havia nenhuma forma de pedir outro.
   *
   * Throttle apertado porque a rota dispara e-mail para terceiros — é a
   * definição de amplificador de spam se ficar aberta.
   */
  @Post("resend-verification")
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({
    summary: "Reenvia o e-mail de verificação",
    description:
      "Resposta idêntica exista ou não conta para o endereço — responder diferente transformaria a rota num oráculo de enumeração de cadastros.",
  })
  @ApiResponse({ status: 200, description: "Mensagem genérica" })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    return this.verifyEmailService.resend(dto.email);
  }

  /**
   * Rota LEGADA — os e-mails já enviados apontam para cá e continuam existindo
   * no mundo (TTL de 24h, mas caixas de entrada não expiram).
   *
   * 🔴 Ela NÃO confirma mais nada: redireciona para a página do web levando o
   * token. Manter a confirmação aqui deixaria os links antigos sujeitos ao
   * mesmo prefetch que motivou a mudança.
   *
   * `@Res()` direto porque `@Redirect()` seria envolvido pelo
   * `WrapperDataInterceptor` global e o redirect viraria um JSON.
   */
  @Get("verify-email")
  @Public()
  @ApiOperation({
    summary: "(Legado) Redireciona para a página de verificação do web",
  })
  @ApiQuery({ name: "token", required: true })
  @ApiResponse({
    status: 302,
    description: "Redireciona para /verificar-email",
  })
  verifyEmailLegacy(@Query("token") token: string, @Res() res: Response): void {
    res.redirect(
      HttpStatus.FOUND,
      this.verifyEmailService.buildPageUrl(token ?? ""),
    );
  }
}
