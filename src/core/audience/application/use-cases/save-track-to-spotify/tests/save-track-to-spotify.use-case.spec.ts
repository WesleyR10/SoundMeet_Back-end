import { AudienceSpotifyLink } from "../../../../domain/audience-spotify-link.aggregate";
import { AudienceSpotifyLinkInMemoryRepository } from "../../../../infra/db/in-memory/audience-spotify-link-in-memory.repository";
import {
  ISpotifyLibraryGateway,
  ISpotifyOAuthGateway,
  SpotifyTokens,
  SpotifyTrack,
} from "../../../../infra/gateways/spotify.gateway";
import { SpotifyAccessService } from "../../../services/spotify-access.service";
import { FindSpotifyTrackUseCase } from "../find-spotify-track.use-case";
import { SaveTrackToSpotifyUseCase } from "../save-track-to-spotify.use-case";

const AUDIENCE_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-09-12T12:00:00Z");

class FakeSpotify implements ISpotifyOAuthGateway, ISpotifyLibraryGateway {
  refreshCalls = 0;
  saved: { trackId: string; token: string }[] = [];
  searchedWith: string[] = [];
  track: SpotifyTrack | null = {
    id: "track_1",
    title: "Garota de Ipanema",
    artist: "Tom Jobim",
    album: "Getz/Gilberto",
    artwork_url: "https://img/capa.jpg",
    preview_url: null,
  };

  buildAuthorizationUrl(): string {
    return "https://accounts.spotify.com/authorize";
  }

  async exchangeCode(): Promise<SpotifyTokens> {
    throw new Error("não usado");
  }

  async refresh(): Promise<SpotifyTokens> {
    this.refreshCalls += 1;
    return {
      spotify_user_id: "",
      access_token: "access_renovado",
      refresh_token: null,
      expires_at: new Date(NOW.getTime() + 3_600_000),
    };
  }

  async searchTrack(
    _query: { title: string; artist: string },
    accessToken: string,
  ): Promise<SpotifyTrack | null> {
    this.searchedWith.push(accessToken);
    return this.track;
  }

  async saveTrack(trackId: string, accessToken: string): Promise<void> {
    this.saved.push({ trackId, token: accessToken });
  }
}

describe("Salvar no Spotify", () => {
  let linkRepo: AudienceSpotifyLinkInMemoryRepository;
  let spotify: FakeSpotify;
  let find: FindSpotifyTrackUseCase;
  let save: SaveTrackToSpotifyUseCase;

  beforeEach(() => {
    linkRepo = new AudienceSpotifyLinkInMemoryRepository();
    spotify = new FakeSpotify();
    const access = new SpotifyAccessService(linkRepo, spotify, {
      now: () => NOW,
    });
    find = new FindSpotifyTrackUseCase(access, spotify);
    save = new SaveTrackToSpotifyUseCase(access, spotify);
  });

  async function seedLink(expiresAt = new Date(NOW.getTime() + 3_600_000)) {
    const link = AudienceSpotifyLink.create({
      audience_id: AUDIENCE_ID,
      spotify_user_id: "spot_user",
      access_token: "access_valido",
      refresh_token: "refresh_1",
      expires_at: expiresAt,
    });
    await linkRepo.insert(link);
    return link;
  }

  describe("busca do candidato", () => {
    it("devolve a faixa encontrada", async () => {
      await seedLink();

      const output = await find.execute({
        audience_id: AUDIENCE_ID,
        title: "Garota de Ipanema",
        artist: "Tom Jobim",
      });

      expect(output).toEqual({
        linked: true,
        found: true,
        track: expect.objectContaining({ id: "track_1" }),
      });
    });

    it("'não vinculado' é ESTADO, não exceção", async () => {
      // A UI mostra caminhos diferentes para "conectar conta" e "faixa não
      // encontrada"; lançar obrigaria o cliente a ler mensagem de erro.
      const output = await find.execute({
        audience_id: AUDIENCE_ID,
        title: "x",
        artist: "y",
      });

      expect(output).toEqual({ linked: false });
    });

    it("'não encontrada' é ESTADO, não exceção", async () => {
      await seedLink();
      spotify.track = null;

      const output = await find.execute({
        audience_id: AUDIENCE_ID,
        title: "Música Inexistente",
        artist: "Ninguém",
      });

      expect(output).toEqual({ linked: true, found: false });
    });

    it("🔴 NÃO salva nada — quem confirma é o fã", async () => {
      await seedLink();

      await find.execute({
        audience_id: AUDIENCE_ID,
        title: "Garota de Ipanema",
        artist: "Tom Jobim",
      });

      expect(spotify.saved).toEqual([]);
    });
  });

  describe("salvamento", () => {
    it("salva a faixa confirmada", async () => {
      await seedLink();

      const output = await save.execute({
        audience_id: AUDIENCE_ID,
        track_id: "track_1",
      });

      expect(output).toEqual({ linked: true, saved: true });
      expect(spotify.saved).toEqual([
        { trackId: "track_1", token: "access_valido" },
      ]);
    });

    it("recusa track_id vazio", async () => {
      await seedLink();

      await expect(
        save.execute({ audience_id: AUDIENCE_ID, track_id: "  " }),
      ).rejects.toThrow(/track_id/);
    });

    it("não salva para quem não vinculou", async () => {
      const output = await save.execute({
        audience_id: AUDIENCE_ID,
        track_id: "track_1",
      });

      expect(output).toEqual({ linked: false });
      expect(spotify.saved).toEqual([]);
    });
  });

  describe("token vencido", () => {
    it("renova, PERSISTE e usa o token novo", async () => {
      // Renovar sem gravar faria a próxima chamada renovar de novo — e alguns
      // provedores invalidam o refresh anterior a cada uso.
      const link = await seedLink(new Date(NOW.getTime() - 60_000));

      await save.execute({ audience_id: AUDIENCE_ID, track_id: "track_1" });

      expect(spotify.refreshCalls).toBe(1);
      expect(spotify.saved[0].token).toBe("access_renovado");

      const persisted = await linkRepo.findById(link.link_id);
      expect(persisted!.access_token).toBe("access_renovado");
      // Provedor não mandou refresh novo — o antigo tem que sobreviver.
      expect(persisted!.refresh_token).toBe("refresh_1");
    });

    it("não renova quando o token ainda é válido", async () => {
      await seedLink();

      await save.execute({ audience_id: AUDIENCE_ID, track_id: "track_1" });

      expect(spotify.refreshCalls).toBe(0);
    });
  });
});
