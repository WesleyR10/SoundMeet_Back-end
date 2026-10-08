export type SpotifyCatalogTrack = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  artwork_url: string | null;
  duration_seconds: number | null;
};

export type SearchSpotifyCatalogInput = {
  title: string;
  artist: string;
  /** Até 10 — o teto do `/v1/search` desde fev/2026 (antes eram 50). */
  limit?: number;
};

/**
 * Catálogo do Spotify, lido com **credenciais de aplicação** (Client
 * Credentials), sem usuário.
 *
 * ## Por que esta porta existe separada de `ISpotifyLibraryGateway`
 *
 * São dois fluxos de autenticação diferentes, com tetos diferentes, servindo a
 * donos diferentes:
 *
 * - `ISpotifyLibraryGateway` (em `core/audience/`) usa o token DO FÃ e escreve
 *   na biblioteca dele. Depende de OAuth, e portanto do teto de **5 usuários**
 *   do Development Mode.
 * - Esta porta usa o token DA APLICAÇÃO e só lê catálogo público. **Não passa
 *   pelo teto de usuários**, porque não há usuário autorizando nada.
 *
 * É essa distinção que permite a feature existir hoje: resolvemos a faixa certa
 * para todo mundo, e só o *salvar* fica limitado enquanto não houver Extended
 * Quota (que exige 250k MAU e pessoa jurídica).
 *
 * ⚠️ Não peça `preview_url` aqui. O campo foi descontinuado em 27/nov/2024 para
 * apps criados depois dessa data — o nosso é —, então virá sempre `null`, e
 * expor um campo que nunca preenche vira promessa quebrada na UI.
 */
export interface ISpotifyCatalogGateway {
  searchTracks(
    input: SearchSpotifyCatalogInput,
  ): Promise<SpotifyCatalogTrack[]>;
}
