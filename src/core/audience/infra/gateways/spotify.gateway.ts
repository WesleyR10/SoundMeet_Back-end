/**
 * Portas do Spotify.
 *
 * Duas interfaces, e não uma, porque são dois eixos independentes: o vínculo
 * (OAuth, tokens) e a biblioteca (buscar e salvar faixa). O job de renovação
 * depende só da primeira; o fluxo de "salvar essa música" depende das duas. Uma
 * porta única obrigaria qualquer dublê de teste a implementar métodos que o
 * caso em questão nunca chama.
 */

export type SpotifyTokens = {
  spotify_user_id: string;
  access_token: string;
  /**
   * ⚠️ **Opcional na RENOVAÇÃO.** O Spotify nem sempre devolve um refresh novo;
   * quando não devolve, o anterior continua válido. Tipar como obrigatório aqui
   * faria o adapter inventar string vazia — e um refresh vazio mata o vínculo
   * em silêncio, com o sintoma aparecendo semanas depois.
   */
  refresh_token: string | null;
  expires_at: Date;
};

export interface ISpotifyOAuthGateway {
  /** URL de consentimento. O `state` assinado amarra a autorização a um fã. */
  buildAuthorizationUrl(state: string): string;

  exchangeCode(code: string): Promise<SpotifyTokens>;

  refresh(refreshToken: string): Promise<SpotifyTokens>;
}

/** Uma faixa no catálogo do provedor. */
export type SpotifyTrack = {
  /** Id da faixa — o que se guarda para salvar depois. */
  id: string;
  title: string;
  artist: string;
  album: string | null;
  /** Capa do álbum, para o fã confirmar visualmente que é a música certa. */
  artwork_url: string | null;
  /** Trecho de 30s, quando o provedor oferece. */
  preview_url: string | null;
};

export interface ISpotifyLibraryGateway {
  /**
   * Procura a faixa no catálogo.
   *
   * Devolve o melhor candidato ou `null` — nunca uma lista longa. A decisão de
   * produto é confirmar UMA sugestão, não fazer o fã escolher entre dez
   * remasterizações no meio de um show.
   */
  searchTrack(
    query: { title: string; artist: string },
    accessToken: string,
  ): Promise<SpotifyTrack | null>;

  /** Salva na biblioteca do fã (`user-library-modify`). Idempotente no provedor. */
  saveTrack(trackId: string, accessToken: string): Promise<void>;
}
