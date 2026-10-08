import { SpotifyCatalogTrack } from "../ports/spotify-catalog.interface";

export type SpotifyMatchInput = {
  title: string;
  artist: string;
  /** Duração da gravação que o MÚSICO analisou. O sinal que separa versões. */
  duration_seconds: number | null;
};

export type SpotifyMatch = {
  track: SpotifyCatalogTrack;
  score: number;
  /** Diferença de duração, quando os dois lados a conhecem. */
  duration_diff_seconds: number | null;
};

/**
 * Score mínimo para gravar o casamento.
 *
 * Abaixo disto preferimos NÃO ter link a ter o link errado: o botão some, e o
 * fã fica sem uma conveniência — em vez de ser mandado para a faixa de outro
 * artista com o mesmo nome de música.
 */
export const MIN_ACCEPTABLE_SCORE = 0.62;

/**
 * Score a partir do qual o casamento é bom o bastante para **escrever** na
 * biblioteca do fã sem ele confirmar.
 *
 * Mais alto que `MIN_ACCEPTABLE_SCORE` de propósito: o custo do erro é
 * assimétrico. Abrir a faixa errada no Spotify é um toque desperdiçado que a
 * pessoa vê na hora; salvar a faixa errada é escrever na conta dela algo que
 * ela só descobre depois.
 */
export const AUTO_SAVE_SCORE = 0.9;

/**
 * Marcas que denunciam versão diferente da gravação de estúdio.
 *
 * ⚠️ Escritas **já normalizadas** (minúsculas, sem acento): são comparadas
 * contra a saída de `normalize()`, então "acústico" aqui nunca casaria com
 * "acustico" de lá.
 */
const VERSION_MARKERS = [
  "ao vivo",
  "live",
  "acustic",
  "acoustic",
  "remix",
  "remaster",
  "cover",
  "karaok",
  "instrumental",
  "playback",
  "versao",
  "version",
  "edit",
  "mix",
];

/**
 * Escolhe qual faixa do Spotify corresponde à música da biblioteca.
 *
 * ## O problema: a mesma música tem muitas versões
 *
 * Estúdio, ao vivo, acústico, remaster, participação, tributo e homônimo
 * competem pelo mesmo par título+artista. Escolher pelo primeiro resultado
 * acerta na maioria e erra numa minoria que a pessoa só percebe depois.
 *
 * ## O sinal que resolve: DURAÇÃO
 *
 * O pipeline MIR analisou o áudio exato que o músico escolheu, então
 * `MusicLibrary.duration_seconds` é a duração daquela gravação. Versões
 * diferentes têm durações diferentes — é o disambiguador mais forte disponível.
 *
 * Não é teoria: `synced-lyrics` levou exatamente esse bug em jul/2026, casando
 * LRC de *"radio edit vs. ao vivo estendido"* por não pontuar duração
 * (`Docs/ia-musical/folha-de-cifra.md:244`). A correção foi a mesma escada de
 * buckets reusada aqui.
 *
 * ## Por que a duração pesa MAIS aqui que no LRCLIB
 *
 * No LRCLIB a fórmula é `0.55·título + 0.35·artista + 0.10·duração`, porque o
 * acervo é comunitário e os textos vêm sujos — título e artista precisavam
 * carregar o peso. O Spotify devolve metadados limpos e canônicos: título e
 * artista quase sempre casam, inclusive **entre versões diferentes da mesma
 * música**. Aí eles param de discriminar e a duração vira o que decide.
 *
 * ⚠️ **Tom e andamento NÃO entram**, embora o nosso MIR os conheça: os
 * endpoints `/audio-features` e `/audio-analysis` do Spotify foram
 * descontinuados em 27/nov/2024 e respondem 403. Não há com o que comparar.
 */
export class SpotifyTrackMatcher {
  pickBest(
    input: SpotifyMatchInput,
    candidates: SpotifyCatalogTrack[],
  ): SpotifyMatch | null {
    if (candidates.length === 0) return null;

    const desiredTitle = this.normalize(input.title);
    const desiredArtist = this.normalize(input.artist);
    const desiredHasMarker = this.hasVersionMarker(input.title);

    let best: SpotifyMatch | null = null;

    for (const track of candidates) {
      const titleScore = this.textScore(
        desiredTitle,
        this.normalize(track.title),
      );
      const artistScore = this.artistScore(desiredArtist, track.artist);
      const durationScore = this.durationScore(
        input.duration_seconds,
        track.duration_seconds,
      );

      // 🔴 Artista é ELIMINATÓRIO, não só ponderado.
      //
      // Com peso apenas, título 1.0 + duração 1.0 somam 0.74 e passam do piso
      // mesmo com artista zerado — ou seja, o cover de uma banda tributo com a
      // mesma duração venceria a gravação original. A busca já usa o
      // qualificador `artist:`, então artista que não casa com NENHUM nome
      // devolvido é sinal de que o Spotify alargou a consulta, não de grafia
      // diferente.
      if (artistScore === 0) continue;

      let score = 0.34 * titleScore + 0.26 * artistScore + 0.4 * durationScore;

      // Desempate por marca de versão: "Evidências" e "Evidências (Ao Vivo)"
      // têm título quase idêntico para o comparador textual. Quando um lado
      // anuncia a versão e o outro não, é sinal de gravação diferente — e
      // quando ambos anunciam, é sinal de que é a mesma.
      if (this.hasVersionMarker(track.title) !== desiredHasMarker) {
        score -= 0.12;
      }

      const candidate: SpotifyMatch = {
        track,
        score: Math.max(0, Math.min(1, score)),
        duration_diff_seconds:
          input.duration_seconds !== null && track.duration_seconds !== null
            ? Math.abs(input.duration_seconds - track.duration_seconds)
            : null,
      };

      if (!best || candidate.score > best.score) best = candidate;
    }

    return best && best.score >= MIN_ACCEPTABLE_SCORE ? best : null;
  }

  /**
   * Escada de buckets herdada do `synced-lyrics`.
   *
   * Sem duração conhecida devolve 0.5 — neutro. Zerar puniria toda música que
   * o pipeline não mediu; dar 1 daria a ela a mesma confiança de um casamento
   * verificado.
   */
  private durationScore(
    desired: number | null,
    candidate: number | null,
  ): number {
    if (desired === null || candidate === null) return 0.5;
    const diff = Math.abs(desired - candidate);
    if (diff <= 2) return 1;
    if (diff <= 6) return 0.8;
    if (diff <= 12) return 0.6;
    return 0.3;
  }

  /**
   * O Spotify devolve os artistas juntos ("Fulano, Beltrano"). Casar contra a
   * string inteira reprovaria toda participação; casar contra qualquer um dos
   * nomes aceita featuring sem aceitar tributo.
   */
  private artistScore(desired: string, candidateArtists: string): number {
    const parts = candidateArtists
      .split(",")
      .map((a) => this.normalize(a))
      .filter(Boolean);

    if (parts.length === 0) return 0;

    return parts.reduce(
      (best, part) => Math.max(best, this.textScore(desired, part)),
      0,
    );
  }

  /**
   * Comparação por contenção, não por igualdade.
   *
   * "Trem Bala" e "trem bala - ao vivo" devem casar bem no eixo do TÍTULO — é a
   * duração e a marca de versão que decidem se é a mesma gravação. Exigir
   * igualdade exata aqui reprovaria o candidato certo por causa de um sufixo de
   * álbum.
   */
  private textScore(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (b.startsWith(a) || a.startsWith(b)) return 0.9;
    if (b.includes(a) || a.includes(b)) return 0.75;
    return 0;
  }

  private hasVersionMarker(text: string): boolean {
    const normalized = this.normalize(text);
    return VERSION_MARKERS.some((marker) => normalized.includes(marker));
  }

  /**
   * Minúsculas, sem acento e sem pontuação — "Evidências" === "evidencias".
   *
   * Mesma normalização de `normalizeForCompare` no `synced-lyrics`: classes
   * Unicode (`\p{Diacritic}`, `\p{L}`, `\p{N}`) em vez de faixas ASCII, senão
   * "ç" e "ã" viram separador em vez de letra.
   */
  private normalize(text: string): string {
    return String(text ?? "")
      .normalize("NFKD")
      .replace(/\p{Diacritic}+/gu, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 200);
  }
}
