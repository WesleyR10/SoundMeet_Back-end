import axios, { AxiosInstance } from "axios";

import {
  ISpotifyLibraryGateway,
  ISpotifyOAuthGateway,
  SpotifyTokens,
  SpotifyTrack,
} from "./spotify.gateway";

export type SpotifyConfig = {
  /** `https://accounts.spotify.com` — consentimento e troca de token. */
  accountsUrl: string;
  /** `https://api.spotify.com` — catálogo e biblioteca. */
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/**
 * Escopo mínimo: só escrever na biblioteca do próprio usuário.
 *
 * 🔴 **Não pedir mais.** Cada escopo extra aparece na tela de consentimento e
 * derruba a taxa de autorização — e pedir leitura de playlists ou de histórico
 * para uma feature que só salva faixa é coletar dado que não se usa.
 */
const SCOPE = "user-library-modify";

/**
 * Spotify Web API.
 *
 * Molde de `MercadoPagoOAuthAdapter`: mesmo `axios.create` com timeout, mesma
 * conversão de `expires_in` (SEGUNDOS) para data absoluta, mesma postura de
 * falhar alto quando falta o que torna o vínculo durável.
 */
export class SpotifyAdapter
  implements ISpotifyOAuthGateway, ISpotifyLibraryGateway
{
  private readonly accounts: AxiosInstance;
  private readonly api: AxiosInstance;

  constructor(private readonly config: SpotifyConfig) {
    this.accounts = axios.create({
      baseURL: config.accountsUrl,
      timeout: 30_000,
    });
    this.api = axios.create({ baseURL: config.apiUrl, timeout: 30_000 });
  }

  buildAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: "code",
      redirect_uri: this.config.redirectUri,
      scope: SCOPE,
      state,
    });

    return `${this.config.accountsUrl}/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<SpotifyTokens> {
    const data = await this.postToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.redirectUri,
    });

    /*
     * 🔴 Na PRIMEIRA autorização o refresh é obrigatório. Sem ele o vínculo
     * dura ~1h e o fã reautorizaria a cada música — o que na prática é a
     * feature não existir. Falhar aqui custa uma retentativa; persistir sem
     * refresh custa a confiança na feature inteira.
     */
    if (!data.refresh_token) {
      throw new Error(
        "Spotify não devolveu refresh_token na autorização inicial",
      );
    }

    return this.toTokens(data, await this.fetchUserId(data.access_token));
  }

  /**
   * Renovação.
   *
   * ⚠️ Não busca o `spotify_user_id` de novo: seria uma chamada a mais por
   * vínculo em cada varredura do job, para um dado que não muda. O agregado
   * preserva o que já tem quando o campo vem vazio.
   */
  async refresh(refreshToken: string): Promise<SpotifyTokens> {
    const data = await this.postToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    return this.toTokens(data, "");
  }

  async searchTrack(
    query: { title: string; artist: string },
    accessToken: string,
  ): Promise<SpotifyTrack | null> {
    /*
     * `track:` e `artist:` em vez de busca livre: sem os qualificadores, o
     * nome do artista no texto casa com faixas que apenas o citam no título
     * (tributos, participações), e a "melhor" resposta vira a errada.
     */
    const q = `track:${query.title} artist:${query.artist}`;

    const { data } = await this.api.get("/v1/search", {
      params: { q, type: "track", limit: 1, market: "BR" },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const item = data?.tracks?.items?.[0];
    if (!item) return null;

    return {
      id: String(item.id),
      title: String(item.name ?? query.title),
      artist: (item.artists ?? [])
        .map((a: { name?: string }) => a?.name)
        .filter(Boolean)
        .join(", "),
      album: item.album?.name ?? null,
      artwork_url: item.album?.images?.[0]?.url ?? null,
      preview_url: item.preview_url ?? null,
    };
  }

  async saveTrack(trackId: string, accessToken: string): Promise<void> {
    await this.api.put(
      "/v1/me/tracks",
      { ids: [trackId] },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );
  }

  /**
   * `client_secret_basic`: o Spotify espera as credenciais no header
   * `Authorization`, e o corpo em `application/x-www-form-urlencoded` — não em
   * JSON, ao contrário do Mercado Pago. Mandar JSON aqui devolve
   * `unsupported_grant_type`, que é um erro que não parece com a causa.
   */
  private async postToken(
    body: Record<string, string>,
  ): Promise<Record<string, any>> {
    const basic = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString("base64");

    const { data } = await this.accounts.post(
      "/api/token",
      new URLSearchParams(body).toString(),
      {
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    return data ?? {};
  }

  /** `GET /v1/me` — quem autorizou. Só na primeira vez. */
  private async fetchUserId(accessToken: string): Promise<string> {
    const { data } = await this.api.get("/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!data?.id) {
      throw new Error("Spotify não devolveu o id da conta autorizada");
    }
    return String(data.id);
  }

  private toTokens(
    data: Record<string, any>,
    spotifyUserId: string,
  ): SpotifyTokens {
    if (!data?.access_token) {
      throw new Error("Spotify não devolveu access_token");
    }

    /*
     * `expires_in` vem em SEGUNDOS. Tratá-lo como milissegundos daria um
     * vencimento no passado e o job renovaria em loop; o contrário deixaria o
     * token vencer sem ninguém renovar. Mesma armadilha registrada no adapter
     * do Mercado Pago.
     */
    const expiresInSeconds = Number(data.expires_in ?? 0);

    return {
      spotify_user_id: spotifyUserId,
      access_token: String(data.access_token),
      refresh_token: data.refresh_token ? String(data.refresh_token) : null,
      expires_at: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }
}
