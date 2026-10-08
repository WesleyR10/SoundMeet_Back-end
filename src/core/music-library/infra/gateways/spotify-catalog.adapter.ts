import axios, { AxiosInstance } from "axios";

import {
  ISpotifyCatalogGateway,
  SearchSpotifyCatalogInput,
  SpotifyCatalogTrack,
} from "../../application/ports/spotify-catalog.interface";

export type SpotifyCatalogConfig = {
  clientId: string;
  clientSecret: string;
  accountsUrl: string;
  apiUrl: string;
  /** ISO 3166-1 alpha-2. Faixa indisponível no mercado não deve ser sugerida. */
  market: string;
};

/**
 * Teto do `/v1/search` desde a mudança de fev/2026 — era 50, virou 10.
 * Pedir mais devolve erro, não uma lista truncada.
 */
const MAX_SEARCH_LIMIT = 10;

/** Folga antes do vencimento, para não usar token que expira em trânsito. */
const TOKEN_SKEW_MS = 60_000;

/**
 * Catálogo do Spotify via **Client Credentials**.
 *
 * ## Por que este adapter existe, separado do `SpotifyAdapter` do fã
 *
 * O `SpotifyAdapter` (em `core/audience/`) fala com o Spotify **em nome de um
 * fã**, com o token dele, e por isso está sujeito ao teto de 5 usuários do
 * Development Mode. Este aqui fala **em nome da aplicação**: só lê catálogo
 * público, não tem usuário, e portanto **não tem teto de usuários**.
 *
 * É essa separação que sustenta o desenho em degraus: resolvemos a faixa certa
 * para todo mundo hoje, e o *salvar na biblioteca* só passa a valer para todos
 * quando houver Extended Quota (que exige pessoa jurídica e 250k MAU).
 *
 * ## O token é de aplicação e vive em memória
 *
 * Dura ~1h e não pertence a ninguém — não há o que cifrar nem o que persistir.
 * Guardar em banco criaria uma linha secreta sem dono para proteger; refazer a
 * cada chamada gastaria um round-trip por busca.
 */
export class SpotifyCatalogAdapter implements ISpotifyCatalogGateway {
  private readonly accounts: AxiosInstance;
  private readonly api: AxiosInstance;

  private token: string | null = null;
  private tokenExpiresAt = 0;
  /** Corridas simultâneas compartilham a MESMA renovação, não uma cada. */
  private pendingToken: Promise<string> | null = null;

  constructor(private readonly config: SpotifyCatalogConfig) {
    this.accounts = axios.create({
      baseURL: config.accountsUrl,
      timeout: 15_000,
    });
    this.api = axios.create({ baseURL: config.apiUrl, timeout: 15_000 });
  }

  async searchTracks(
    input: SearchSpotifyCatalogInput,
  ): Promise<SpotifyCatalogTrack[]> {
    const title = (input.title ?? "").trim();
    const artist = (input.artist ?? "").trim();
    if (!title) return [];

    /*
     * Qualificadores `track:` e `artist:` em vez de busca livre — sem eles, o
     * nome do artista casa com faixas que apenas o citam no título (tributos,
     * participações) e a "melhor" resposta vira a errada.
     *
     * Diferente do adapter do fã, pedimos VÁRIOS candidatos: quem escolhe é o
     * `SpotifyTrackMatcher`, comparando duração. `limit: 1` deixaria o Spotify
     * decidir por relevância, que é justamente o critério que não distingue
     * estúdio de ao vivo.
     */
    const q = artist ? `track:${title} artist:${artist}` : `track:${title}`;
    const limit = Math.min(input.limit ?? MAX_SEARCH_LIMIT, MAX_SEARCH_LIMIT);

    const accessToken = await this.getAccessToken();

    const { data } = await this.api.get("/v1/search", {
      params: { q, type: "track", limit, market: this.config.market },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const items: any[] = data?.tracks?.items ?? [];

    return items.filter(Boolean).map((item) => ({
      id: String(item.id),
      title: String(item.name ?? ""),
      artist: (item.artists ?? [])
        .map((a: { name?: string }) => a?.name)
        .filter(Boolean)
        .join(", "),
      album: item.album?.name ?? null,
      artwork_url: item.album?.images?.[0]?.url ?? null,
      // `duration_ms` é o campo que decide o casamento. Sem ele o matcher cai
      // no score neutro de duração e passa a depender só de texto.
      duration_seconds:
        typeof item.duration_ms === "number"
          ? Math.round(item.duration_ms / 1000)
          : null,
    }));
  }

  private async getAccessToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt - TOKEN_SKEW_MS) {
      return this.token;
    }

    // Sem isto, o job de backfill dispararia N renovações simultâneas na
    // primeira leva — e o Spotify responde 429 a rajada de token.
    this.pendingToken ??= this.requestToken().finally(() => {
      this.pendingToken = null;
    });

    return this.pendingToken;
  }

  /**
   * `client_secret_basic`: as credenciais vão no header `Authorization` e o
   * corpo em `x-www-form-urlencoded`. Mandar JSON devolve
   * `unsupported_grant_type` — erro que não parece com a causa.
   */
  private async requestToken(): Promise<string> {
    const basic = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString("base64");

    const { data } = await this.accounts.post(
      "/api/token",
      new URLSearchParams({ grant_type: "client_credentials" }).toString(),
      {
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const token = String(data?.access_token ?? "");
    if (!token) throw new Error("Spotify não devolveu access_token");

    const expiresIn = Number(data?.expires_in ?? 3600);
    this.token = token;
    this.tokenExpiresAt = Date.now() + expiresIn * 1000;

    return token;
  }
}
