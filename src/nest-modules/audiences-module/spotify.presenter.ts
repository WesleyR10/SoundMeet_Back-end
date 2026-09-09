import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { GetSpotifyLinkStatusOutput } from "../../core/audience/application/use-cases/connect-spotify/get-spotify-link-status.use-case";
import { FindSpotifyTrackOutput } from "../../core/audience/application/use-cases/save-track-to-spotify/find-spotify-track.use-case";

export class SpotifyAuthorizationPresenter {
  @ApiProperty({ description: "URL de consentimento do Spotify." })
  authorization_url: string;

  constructor(output: { authorization_url: string }) {
    this.authorization_url = output.authorization_url;
  }
}

/**
 * 🔴 Nenhum token aqui — nem o de acesso, nem o de renovação, nem o
 * vencimento. A UI decide entre "Conectar" e "Salvar no Spotify"; qualquer
 * coisa além disso é dar ao cliente material para operar a conta do fã.
 */
export class SpotifyLinkStatusPresenter {
  @ApiProperty()
  linked: boolean;

  @ApiProperty({
    nullable: true,
    description: "Id público da conta autorizada, para o fã reconhecê-la.",
  })
  spotify_user_id: string | null;

  @ApiProperty({ nullable: true })
  linked_at: Date | null;

  constructor(output: GetSpotifyLinkStatusOutput) {
    this.linked = output.linked;
    this.spotify_user_id = output.spotify_user_id;
    this.linked_at = output.linked_at;
  }
}

/**
 * Resultado da busca — **candidato**, não confirmação.
 *
 * `linked` e `found` são estados distintos de propósito: a UI mostra "conectar
 * sua conta" para um e "não achamos essa faixa" para o outro, e colapsar os
 * dois num `null` obrigaria o cliente a adivinhar qual mensagem exibir.
 */
export class SpotifyTrackCandidatePresenter {
  @ApiProperty()
  linked: boolean;

  @ApiProperty()
  found: boolean;

  @ApiPropertyOptional({
    description: "Faixa sugerida. Só existe quando `found` é true.",
  })
  track?: {
    id: string;
    title: string;
    artist: string;
    album: string | null;
    artwork_url: string | null;
    preview_url: string | null;
  };

  constructor(output: FindSpotifyTrackOutput) {
    this.linked = output.linked;
    this.found = output.linked === true && output.found === true;
    if (output.linked && output.found) {
      this.track = output.track;
    }
  }
}

export class SpotifySaveResultPresenter {
  @ApiProperty()
  linked: boolean;

  @ApiProperty()
  saved: boolean;

  constructor(output: { linked: boolean; saved?: boolean }) {
    this.linked = output.linked;
    this.saved = output.saved === true;
  }
}
