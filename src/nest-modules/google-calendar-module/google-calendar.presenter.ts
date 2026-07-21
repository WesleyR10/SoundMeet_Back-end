import { ApiProperty } from "@nestjs/swagger";

import { GoogleCalendarStatusOutput } from "../../core/google-calendar/application/use-cases/common/google-calendar-integration-output";

export class GoogleCalendarStatusPresenter {
  @ApiProperty({
    description: "Se o músico tem uma conta Google conectada e ativa",
    example: true,
  })
  connected: boolean;

  @ApiProperty({
    description: "E-mail da conta Google conectada (null se desconectado)",
    example: "musico@gmail.com",
    nullable: true,
  })
  google_account_email: string | null;

  constructor(output: GoogleCalendarStatusOutput) {
    this.connected = output.connected;
    this.google_account_email = output.google_account_email;
  }
}

export class GoogleCalendarConnectUrlPresenter {
  @ApiProperty({
    description:
      "URL de consentimento OAuth do Google — abrir no navegador do músico",
    example: "https://accounts.google.com/o/oauth2/v2/auth?...",
  })
  consent_url: string;

  constructor(consent_url: string) {
    this.consent_url = consent_url;
  }
}

export class GoogleCalendarDisconnectPresenter {
  @ApiProperty({ example: true })
  disconnected: boolean;

  constructor(output: { disconnected: boolean }) {
    this.disconnected = output.disconnected;
  }
}
