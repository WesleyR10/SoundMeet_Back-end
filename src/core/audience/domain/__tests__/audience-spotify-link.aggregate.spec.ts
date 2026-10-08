import { AudienceSpotifyLink } from "../audience-spotify-link.aggregate";

const AUDIENCE_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-09-12T12:00:00Z");
const IN_ONE_HOUR = new Date("2026-09-12T13:00:00Z");

function novoVinculo() {
  return AudienceSpotifyLink.create({
    audience_id: AUDIENCE_ID,
    spotify_user_id: "spot_user",
    access_token: "access_1",
    refresh_token: "refresh_1",
    expires_at: IN_ONE_HOUR,
  });
}

describe("AudienceSpotifyLink", () => {
  describe("criação", () => {
    it("nasce válido com os dois tokens", () => {
      const link = novoVinculo();

      expect(link.notification.hasErrors()).toBe(false);
      expect(link.audience_id.id).toBe(AUDIENCE_ID);
      expect(link.access_token).toBe("access_1");
    });

    it("🔴 recusa vínculo sem refresh_token", () => {
      // Sem refresh o vínculo morre em ~1h e o fã reautorizaria a cada música.
      const link = AudienceSpotifyLink.create({
        audience_id: AUDIENCE_ID,
        spotify_user_id: "spot_user",
        access_token: "access_1",
        refresh_token: "",
        expires_at: IN_ONE_HOUR,
      });

      expect(link.notification.hasErrors()).toBe(true);
    });
  });

  describe("reautorização", () => {
    it("substitui o par de tokens", () => {
      // Diferente da subconta Asaas, aqui não há segredo insubstituível: se o
      // fã reautoriza, o par novo vale mais que o velho.
      const link = novoVinculo();

      link.relink({
        spotify_user_id: "spot_user_2",
        access_token: "access_2",
        refresh_token: "refresh_2",
        expires_at: new Date("2026-09-13T00:00:00Z"),
      });

      expect(link.notification.hasErrors()).toBe(false);
      expect(link.spotify_user_id).toBe("spot_user_2");
      expect(link.refresh_token).toBe("refresh_2");
    });
  });

  describe("renovação", () => {
    it("🔴 PRESERVA o refresh antigo quando o provedor não manda um novo", () => {
      // O Spotify nem sempre devolve refresh na renovação; sobrescrever com
      // vazio mataria o vínculo, e o sintoma apareceria semanas depois.
      const link = novoVinculo();

      link.refreshTokens({
        access_token: "access_novo",
        refresh_token: null,
        expires_at: new Date("2026-09-12T14:00:00Z"),
      });

      expect(link.access_token).toBe("access_novo");
      expect(link.refresh_token).toBe("refresh_1");
      expect(link.notification.hasErrors()).toBe(false);
    });

    it("aceita refresh novo quando ele vem", () => {
      const link = novoVinculo();

      link.refreshTokens({
        access_token: "access_novo",
        refresh_token: "refresh_novo",
        expires_at: new Date("2026-09-12T14:00:00Z"),
      });

      expect(link.refresh_token).toBe("refresh_novo");
    });

    it("recusa renovação sem access_token", () => {
      const link = novoVinculo();

      link.refreshTokens({
        access_token: "  ",
        expires_at: new Date("2026-09-12T14:00:00Z"),
      });

      expect(link.notification.hasErrors()).toBe(true);
      expect(link.access_token).toBe("access_1");
    });
  });

  describe("vencimento", () => {
    it("não está vencido bem antes do prazo", () => {
      expect(novoVinculo().isExpired(NOW)).toBe(false);
    });

    it("considera vencido dentro da folga — evita a corrida com a chamada", () => {
      // 30s antes do vencimento: tecnicamente válido, mas apertado demais para
      // sobreviver à latência da própria requisição que vai usá-lo.
      const link = novoVinculo();

      expect(link.isExpired(new Date("2026-09-12T12:59:30Z"))).toBe(true);
    });

    it("está vencido depois do prazo", () => {
      expect(novoVinculo().isExpired(new Date("2026-09-12T14:00:00Z"))).toBe(
        true,
      );
    });
  });

  describe("toJSON", () => {
    it("🔴 NUNCA expõe os tokens", () => {
      // `toJSON` alimenta output de use case, que vira resposta HTTP — e o
      // access_token ESCREVE na biblioteca do fã.
      const json = novoVinculo().toJSON();

      expect(json).not.toHaveProperty("access_token");
      expect(json).not.toHaveProperty("refresh_token");
      expect(JSON.stringify(json)).not.toContain("access_1");
      expect(JSON.stringify(json)).not.toContain("refresh_1");
    });

    it("expõe o que a UI precisa", () => {
      const json = novoVinculo().toJSON();

      expect(json.audience_id).toBe(AUDIENCE_ID);
      expect(json.spotify_user_id).toBe("spot_user");
    });
  });

  describe("fake builder", () => {
    it("constrói vínculo válido", () => {
      const link = AudienceSpotifyLink.fake().aLink().build();
      expect(link.notification.hasErrors()).toBe(false);
    });

    it("constrói vínculo já vencido para o job", () => {
      const link = AudienceSpotifyLink.fake().aLink().expired().build();
      expect(link.isExpired()).toBe(true);
    });
  });
});
