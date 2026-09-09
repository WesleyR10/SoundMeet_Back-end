import { MusicianOutput } from "../../../core/musician/application/use-cases/common/musician-profile-output";
import {
  MusicianPresenter,
  PublicMusicianPresenter,
} from "../musician.presenter";

function makeOutput(overrides: Partial<MusicianOutput> = {}): MusicianOutput {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "9366b7dc-2d71-4799-b91c-c64adb205104",
    email: "musico@example.com",
    name: "Maria Souza",
    stage_name: "Mari",
    bio: null,
    avatar: null,
    phone: "+5511999999999",
    cnpj: "11222333000181",
    genres: ["MPB"],
    instruments: ["Violão"],
    experience_years: 8,
    qr_code: null,
    qr_customization: null,
    rating: 0,
    total_ratings: 0,
    is_active: true,
    is_verified: false,
    open_to_gigs: null,
    profile: null,
    created_at: now,
    updated_at: now,
    display_name: "Mari",
    is_experienced: true,
    is_highly_rated: false,
    ...overrides,
  };
}

describe("MusicianPresenter — PII do CNPJ", () => {
  /*
   * O CNPJ do MEI identifica a pessoa e é gravado no contrato. Ele segue o
   * mesmo tratamento de email/telefone: sai para o dono e para o admin, nunca
   * para terceiro. `GET /musicians/:id` é `@Public()` e escolhe o presenter no
   * controller — este teste é o que trava a escolha errada.
   */
  it("should expose the cnpj to the owner", () => {
    const presenter = new MusicianPresenter(makeOutput());

    expect(presenter.cnpj).toBe("11222333000181");
  });

  it("should NOT expose the cnpj in the public view", () => {
    const presenter = new PublicMusicianPresenter(makeOutput());

    expect(presenter).not.toHaveProperty("cnpj");
    expect(JSON.stringify(presenter)).not.toContain("11222333000181");
  });

  it("should keep email and phone out of the public view", () => {
    const presenter = new PublicMusicianPresenter(makeOutput());

    expect(presenter).not.toHaveProperty("email");
    expect(presenter).not.toHaveProperty("phone");
  });

  it("should carry a null cnpj for a musician without MEI", () => {
    const presenter = new MusicianPresenter(makeOutput({ cnpj: null }));

    expect(presenter.cnpj).toBeNull();
  });
});
