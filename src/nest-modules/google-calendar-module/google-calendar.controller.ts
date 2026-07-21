import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { DisconnectGoogleCalendarUseCase } from "../../core/google-calendar/application/use-cases/disconnect-google-calendar/disconnect-google-calendar.use-case";
import { GetGoogleCalendarStatusUseCase } from "../../core/google-calendar/application/use-cases/get-google-calendar-status/get-google-calendar-status.use-case";
import {
  AuthGuard,
  CurrentUserContextGuard,
  Roles,
  RolesGuard,
} from "../auth-module";
import { MusicianOwnershipGuard } from "../auth-module/ownership/musician-ownership.guard";
import { EnvConfig } from "../config-module/config.schema";
import {
  GoogleCalendarConnectUrlPresenter,
  GoogleCalendarDisconnectPresenter,
  GoogleCalendarStatusPresenter,
} from "./google-calendar.presenter";
import { GoogleCalendarOAuthStateService } from "./google-calendar-oauth-state.service";

const GOOGLE_OAUTH_AUTHORIZE_URL =
  "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events openid email";

@ApiTags("Google Calendar")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("musicians/:musician_id/google-calendar")
export class GoogleCalendarController {
  @Inject(GetGoogleCalendarStatusUseCase)
  private getStatusUseCase: GetGoogleCalendarStatusUseCase;

  @Inject(DisconnectGoogleCalendarUseCase)
  private disconnectUseCase: DisconnectGoogleCalendarUseCase;

  @Inject(GoogleCalendarOAuthStateService)
  private oauthStateService: GoogleCalendarOAuthStateService;

  constructor(private readonly configService: ConfigService<EnvConfig>) {}

  @Get("connect")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Gerar URL de conexão com o Google Calendar",
    description:
      "Retorna a URL de consentimento OAuth do Google (escopo mínimo calendar.events) " +
      "com state assinado anti-CSRF. O músico abre a URL, autoriza, e o Google " +
      "redireciona para o callback público com o code.",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: GoogleCalendarConnectUrlPresenter })
  async connect(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
  ) {
    const params = new URLSearchParams({
      client_id:
        this.configService.get<string>("GOOGLE_CALENDAR_CLIENT_ID") ?? "",
      redirect_uri:
        this.configService.get<string>("GOOGLE_CALENDAR_REDIRECT_URI") ?? "",
      response_type: "code",
      scope: GOOGLE_CALENDAR_SCOPE,
      // offline + consent garantem refresh_token em toda (re)conexão.
      access_type: "offline",
      prompt: "consent",
      state: this.oauthStateService.sign(musician_id),
    });

    return new GoogleCalendarConnectUrlPresenter(
      `${GOOGLE_OAUTH_AUTHORIZE_URL}?${params.toString()}`,
    );
  }

  @Get("status")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Status da integração com o Google Calendar",
    description:
      "Retorna se há conta conectada e o e-mail dela. Tokens nunca são expostos.",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: GoogleCalendarStatusPresenter })
  async status(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
  ) {
    const output = await this.getStatusUseCase.execute({ musician_id });
    return new GoogleCalendarStatusPresenter(output);
  }

  @Delete()
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: "Desconectar o Google Calendar",
    description:
      "Revoga o token no Google (best-effort) e zera os tokens locais. " +
      "Bookings futuros deixam de ser sincronizados até nova conexão.",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: GoogleCalendarDisconnectPresenter })
  async disconnect(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
  ) {
    const output = await this.disconnectUseCase.execute({ musician_id });
    return new GoogleCalendarDisconnectPresenter(output);
  }
}
