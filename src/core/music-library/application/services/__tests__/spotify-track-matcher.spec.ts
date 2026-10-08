import { SpotifyCatalogTrack } from "../../ports/spotify-catalog.interface";
import {
  MIN_ACCEPTABLE_SCORE,
  SpotifyTrackMatcher,
} from "../spotify-track-matcher";

function track(over: Partial<SpotifyCatalogTrack> = {}): SpotifyCatalogTrack {
  return {
    id: over.id ?? "track-1",
    title: over.title ?? "Evidências",
    artist: over.artist ?? "Chitãozinho & Xororó",
    album: over.album ?? "Álbum",
    artwork_url: null,
    duration_seconds: over.duration_seconds ?? 280,
    ...over,
  };
}

describe("SpotifyTrackMatcher", () => {
  const matcher = new SpotifyTrackMatcher();

  it("sem candidatos não inventa casamento", () => {
    expect(
      matcher.pickBest(
        { title: "Evidências", artist: "Chitãozinho", duration_seconds: 280 },
        [],
      ),
    ).toBeNull();
  });

  describe("🔴 escolha entre versões da MESMA música", () => {
    it("prefere a versão cuja DURAÇÃO bate com a gravação analisada", () => {
      const estudio = track({ id: "estudio", duration_seconds: 281 });
      const aoVivo = track({
        id: "ao-vivo",
        title: "Evidências - Ao Vivo",
        duration_seconds: 355,
      });

      const match = matcher.pickBest(
        {
          title: "Evidências",
          artist: "Chitãozinho & Xororó",
          duration_seconds: 280,
        },
        // Ao vivo PRIMEIRO: se a escolha fosse por ordem de relevância do
        // Spotify, este teste passaria com a resposta errada.
        [aoVivo, estudio],
      );

      expect(match?.track.id).toBe("estudio");
      expect(match?.duration_diff_seconds).toBe(1);
    });

    it("escolhe a AO VIVO quando foi a ao vivo que o músico analisou", () => {
      const estudio = track({ id: "estudio", duration_seconds: 281 });
      const aoVivo = track({
        id: "ao-vivo",
        title: "Evidências - Ao Vivo",
        duration_seconds: 356,
      });

      const match = matcher.pickBest(
        {
          title: "Evidências (Ao Vivo)",
          artist: "Chitãozinho & Xororó",
          duration_seconds: 355,
        },
        [estudio, aoVivo],
      );

      expect(match?.track.id).toBe("ao-vivo");
    });

    it("penaliza marca de versão que só um lado tem", () => {
      // Mesma duração nos dois: só a marca "Ao Vivo" decide.
      const estudio = track({ id: "estudio", duration_seconds: 280 });
      const aoVivo = track({
        id: "ao-vivo",
        title: "Evidências (Ao Vivo)",
        duration_seconds: 280,
      });

      const match = matcher.pickBest(
        {
          title: "Evidências",
          artist: "Chitãozinho & Xororó",
          duration_seconds: 280,
        },
        [aoVivo, estudio],
      );

      expect(match?.track.id).toBe("estudio");
    });
  });

  describe("artista", () => {
    it("aceita participação — casa contra qualquer nome da lista", () => {
      const comFeat = track({
        id: "feat",
        artist: "Marília Mendonça, Maiara & Maraisa",
      });

      const match = matcher.pickBest(
        {
          title: "Evidências",
          artist: "Marília Mendonça",
          duration_seconds: 280,
        },
        [comFeat],
      );

      expect(match?.track.id).toBe("feat");
    });

    it("recusa homônimo de outro artista", () => {
      const outroArtista = track({
        id: "outro",
        artist: "Banda Desconhecida",
        duration_seconds: 280,
      });

      const match = matcher.pickBest(
        {
          title: "Evidências",
          artist: "Chitãozinho & Xororó",
          duration_seconds: 280,
        },
        [outroArtista],
      );

      // Título e duração batem, artista não — abaixo do piso.
      expect(match).toBeNull();
    });
  });

  describe("normalização", () => {
    it("ignora acento e caixa", () => {
      const match = matcher.pickBest(
        {
          title: "EVIDENCIAS",
          artist: "chitaozinho & xororo",
          duration_seconds: 280,
        },
        [track({ duration_seconds: 280 })],
      );

      expect(match).not.toBeNull();
      expect(match!.score).toBeGreaterThan(MIN_ACCEPTABLE_SCORE);
    });
  });

  describe("duração desconhecida", () => {
    it("não zera o score — cai no neutro e decide por texto", () => {
      const match = matcher.pickBest(
        {
          title: "Evidências",
          artist: "Chitãozinho & Xororó",
          duration_seconds: null,
        },
        [track({ duration_seconds: null })],
      );

      expect(match).not.toBeNull();
      expect(match!.duration_diff_seconds).toBeNull();
    });

    it("com duração desconhecida, duas versões viram empate — e a primeira vence", () => {
      // Documenta a consequência assumida: sem duração o matcher perde o
      // sinal que separa versões. É o motivo de `duration_seconds` ser gravado
      // ANTES da resolução, no pipeline.
      const a = track({ id: "a", duration_seconds: null });
      const b = track({ id: "b", duration_seconds: null });

      const match = matcher.pickBest(
        {
          title: "Evidências",
          artist: "Chitãozinho & Xororó",
          duration_seconds: null,
        },
        [a, b],
      );

      expect(match?.track.id).toBe("a");
    });
  });

  describe("piso de aceitação", () => {
    it("prefere NENHUM link a um link ruim", () => {
      const ruim = track({
        id: "ruim",
        title: "Outra Música Completamente Diferente",
        artist: "Outro Artista",
        duration_seconds: 90,
      });

      expect(
        matcher.pickBest(
          {
            title: "Evidências",
            artist: "Chitãozinho & Xororó",
            duration_seconds: 280,
          },
          [ruim],
        ),
      ).toBeNull();
    });
  });
});
