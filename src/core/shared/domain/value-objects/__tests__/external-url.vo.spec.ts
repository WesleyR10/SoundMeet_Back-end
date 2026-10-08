import {
  ExternalUrl,
  inspectExternalUrl,
  inspectSocialLink,
  InvalidExternalUrlError,
  isWithinDomain,
  parseExternalUrl,
} from "../external-url.vo";

/*
 * Os vetores abaixo são os mesmos que `soundmeet-mobile/src/shared/utils/
 * external-url.ts` já barra na leitura (SM-025). Portá-los para cá é o ponto do
 * INP-2: até agora a defesa existia só no cliente, e "o front filtra" não cobre
 * cliente HTTP cru, app antigo, nem terceiro lendo a nossa API.
 */
describe("ExternalUrl (INP-2)", () => {
  describe("aceita", () => {
    it.each([
      "https://instagram.com/soundmeet",
      "https://www.instagram.com/soundmeet",
      "https://open.spotify.com/artist/123",
      "https://youtu.be/abc",
      "https://meu-bar.com.br",
      "https://sub.dominio.exemplo.com/caminho?a=1#frag",
      "https://exemplo.com:8443/x",
    ])("%s", (url) => {
      expect(parseExternalUrl(url)).not.toBeNull();
    });

    it("normaliza o host para minúsculas", () => {
      expect(parseExternalUrl("https://INSTAGRAM.com/x")?.host).toBe(
        "instagram.com",
      );
    });

    it("tolera espaço em volta", () => {
      expect(parseExternalUrl("  https://instagram.com/x  ")).not.toBeNull();
    });
  });

  describe("recusa", () => {
    it.each([
      // Downgrade: o link vira interceptável, e o badge continua dizendo "IG".
      ["http://instagram.com/x", "not_https"],
      // Esquemas que viram execução ou leitura local.
      ["javascript:alert(1)", "not_https"],
      ["data:text/html;base64,PHNjcmlwdD4=", "not_https"],
      ["file:///etc/passwd", "not_https"],
      ["intent://evil#Intent;end", "not_https"],
      // 🔴 O clássico: tudo antes do `@` é userinfo. O texto começa com
      // "instagram.com" e quem abre é evil.example.
      ["https://instagram.com@evil.example/", "has_userinfo"],
      ["https://a@instagram.com@evil.example/", "has_userinfo"],
      // Percent-encoding no host: `%69nstagram.com` decodifica para
      // `instagram.com` no navegador — aqui não damos essa chance.
      ["https://%69nstagram.com/x", "invalid_host"],
      // Homógrafo cirílico — indistinguível na tela.
      ["https://instagrаm.com/x", "invalid_host"],
      // Barra invertida: a WHATWG a trata como `/`, mudando onde o host acaba.
      ["https://instagram.com\\@evil.example/", "unsafe_characters"],
      // TAB no meio do esquema: o navegador remove e chega em https.
      ["ht\ttps://instagram.com/x", "unsafe_characters"],
      // Relativo / sem esquema não é link absoluto.
      ["//evil.example/x", "not_https"],
      ["instagram.com/x", "not_https"],
      ["", "empty"],
    ])("%s", (url, reason) => {
      const result = inspectExternalUrl(url);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toBe(reason);
    });

    it("🔴 IP cru — o alvo de metadados de nuvem", () => {
      // Sem isto, `website` do estabelecimento vira um convite a SSRF para
      // qualquer serviço que um dia resolva buscar aquele link.
      expect(
        parseExternalUrl("https://169.254.169.254/latest/meta-data/"),
      ).toBeNull();
      expect(parseExternalUrl("https://127.0.0.1/admin")).toBeNull();
    });

    it("host interno sem ponto (localhost) não passa", () => {
      expect(parseExternalUrl("https://localhost/x")).toBeNull();
      expect(parseExternalUrl("https://minio/x")).toBeNull();
    });

    it("porta não numérica não passa", () => {
      expect(parseExternalUrl("https://exemplo.com:evil/x")).toBeNull();
    });

    it("IPv6 é recusado em vez de parseado pela metade", () => {
      expect(parseExternalUrl("https://[::1]/x")).toBeNull();
    });

    it("URL absurdamente longa não passa", () => {
      expect(
        parseExternalUrl(`https://exemplo.com/${"a".repeat(600)}`),
      ).toBeNull();
    });
  });

  describe("isWithinDomain", () => {
    it("🔴 exige o ponto — senão notinstagram.com passa por instagram.com", () => {
      expect(isWithinDomain("notinstagram.com", "instagram.com")).toBe(false);
      expect(isWithinDomain("instagram.com", "instagram.com")).toBe(true);
      expect(isWithinDomain("www.instagram.com", "instagram.com")).toBe(true);
    });

    it("não confunde o domínio no meio do host", () => {
      expect(
        isWithinDomain("instagram.com.evil.example", "instagram.com"),
      ).toBe(false);
    });
  });

  describe("VO com allowlist de domínio", () => {
    it("aceita host dentro da allowlist", () => {
      const vo = new ExternalUrl("https://www.instagram.com/x", [
        "instagram.com",
      ]);
      expect(vo.host).toBe("www.instagram.com");
    });

    it("recusa host fora da allowlist", () => {
      expect(
        () => new ExternalUrl("https://evil.example/x", ["instagram.com"]),
      ).toThrow(InvalidExternalUrlError);
    });

    it("sem allowlist, qualquer host https válido serve (caso do website)", () => {
      expect(() => new ExternalUrl("https://meu-bar.com.br")).not.toThrow();
    });

    it("create devolve Either em vez de lançar", () => {
      const [ok, err] = ExternalUrl.create("http://instagram.com/x");
      expect(ok).toBeNull();
      expect(err).toBeInstanceOf(InvalidExternalUrlError);
    });
  });
});

/*
 * 🔴 O campo de rede social NÃO guarda URL — guarda o que o músico digitou.
 * `musician.validation.ts` no app é `z.string().trim()`, e
 * `useEditProfileSectionSubmits.ts` manda o valor cru; quem monta o endereço é
 * `buildSocialUrl`, só na hora de abrir. Uma validação de backend que exigisse
 * `https://` daria 422 para todo mundo que digitou `@joao` — que é o caminho
 * principal da UI. Estes casos existem para que ninguém "conserte" isso depois.
 */
describe("inspectSocialLink (INP-2)", () => {
  describe("aceita handle, que é o caminho principal da UI", () => {
    it.each([
      ["instagram", "@joao"],
      ["instagram", "joao"],
      ["instagram", "instagram.com/joao"],
      ["instagram", "https://instagram.com/joao"],
      ["instagram", "https://www.instagram.com/joao"],
      ["youtube", "@canal"],
      ["youtube", "https://youtu.be/abc"],
      ["youtube", "https://youtube.com/@canal"],
      ["spotify", "artist/123"],
      ["spotify", "https://open.spotify.com/artist/123"],
    ])("%s: %s", (platform, value) => {
      expect(
        inspectSocialLink(
          platform as "instagram" | "youtube" | "spotify",
          value,
        ).ok,
      ).toBe(true);
    });
  });

  describe("recusa", () => {
    it.each([
      // Downgrade explícito.
      ["instagram", "http://instagram.com/joao"],
      // Esquema perigoso — nunca prefixar https sobre esquema existente.
      ["instagram", "javascript:alert(1)"],
      ["instagram", "data:text/html,<script>"],
      // Userinfo: o texto começa com instagram.com, o destino é evil.example.
      ["instagram", "https://instagram.com@evil.example/"],
      // URL completa de OUTRO domínio no campo do Instagram.
      ["instagram", "https://evil.example/joao"],
      // Domínio parecido.
      ["instagram", "https://notinstagram.com/joao"],
      // Rede trocada: link do YouTube no campo do Spotify.
      ["spotify", "https://youtube.com/@canal"],
    ])("%s: %s", (platform, value) => {
      expect(
        inspectSocialLink(
          platform as "instagram" | "youtube" | "spotify",
          value,
        ).ok,
      ).toBe(false);
    });

    it("host desconhecido SEM esquema vira caminho dentro da rede, não visita", () => {
      // `evil.example/x` no campo do Instagram não é recusado — é tratado como
      // handle e vira `https://instagram.com/evil.example/x`: link morto dentro
      // do Instagram, nunca uma visita a evil.example. Mesma decisão de
      // `buildSocialUrl` no app; o host resultante é o que prova.
      const result = inspectSocialLink("instagram", "evil.example/x");

      expect(result.ok).toBe(true);
      expect(result.ok === true && result.parsed.host).toBe("instagram.com");
    });
  });
});
