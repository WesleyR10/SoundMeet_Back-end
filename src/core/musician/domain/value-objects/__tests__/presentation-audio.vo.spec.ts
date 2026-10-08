import {
  InvalidPresentationAudioError,
  PresentationAudio,
} from "../presentation-audio.vo";

const VALID = {
  url: "https://cdn.test/musicians/abc/presentation-audio/x.mp3",
  object_key: "musicians/abc/presentation-audio/x.mp3",
  duration_seconds: 32,
};

describe("PresentationAudio Value Object", () => {
  it("guarda url, chave, duração e data", () => {
    const uploadedAt = new Date("2026-09-16T12:00:00.000Z");
    const audio = new PresentationAudio({ ...VALID, uploaded_at: uploadedAt });

    expect(audio.toJSON()).toEqual({
      url: VALID.url,
      object_key: VALID.object_key,
      duration_seconds: 32,
      uploaded_at: uploadedAt,
    });
  });

  it("arredonda a duração — a tela mostra 0:38, não 37,84", () => {
    expect(
      new PresentationAudio({ ...VALID, duration_seconds: 37.84 })
        .duration_seconds,
    ).toBe(38);
  });

  /*
   * 🔴 A regressão que importa. Quando o storage não tem base pública
   * configurada, `getPublicUrl` devolve null e o padrão do avatar grava a
   * object key crua no campo de URL. Numa `<img>` isso dá ícone quebrado; num
   * `<audio src="musicians/...">` o browser resolve como caminho RELATIVO à
   * página aberta, pede /dashboard/artistas/musicians/... e fica mudo, sem
   * erro nenhum. Aceitar URL relativa aqui é reabrir esse silêncio.
   */
  it("recusa URL relativa (é a object key crua disfarçada de URL)", () => {
    expect(
      () =>
        new PresentationAudio({
          ...VALID,
          url: "musicians/abc/presentation-audio/x.mp3",
        }),
    ).toThrow(InvalidPresentationAudioError);
  });

  it("recusa ficar sem a chave do objeto", () => {
    expect(() => new PresentationAudio({ ...VALID, object_key: "  " })).toThrow(
      InvalidPresentationAudioError,
    );
  });

  it("recusa URL vazia", () => {
    expect(() => new PresentationAudio({ ...VALID, url: "" })).toThrow(
      InvalidPresentationAudioError,
    );
  });

  it.each([0, -3, Number.NaN, Number.POSITIVE_INFINITY])(
    "recusa duração %p",
    (duration) => {
      expect(
        () => new PresentationAudio({ ...VALID, duration_seconds: duration }),
      ).toThrow(InvalidPresentationAudioError);
    },
  );

  /*
   * O nome da classe é contrato com o `GlobalExceptionFilter`: ele mapeia
   * `Invalid*Error` para 422. Renomear para algo fora desse padrão devolveria
   * 500 com alerta no Sentry para um arquivo que o usuário só precisa trocar.
   */
  it("mantém o nome que o filtro global mapeia para 422", () => {
    const error = new InvalidPresentationAudioError("x");
    expect(error.name).toBe("InvalidPresentationAudioError");
    expect(error.name.startsWith("Invalid")).toBe(true);
    expect(error.name.endsWith("Error")).toBe(true);
  });
});
