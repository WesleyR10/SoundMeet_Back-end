import { MusicianOutput } from "../../../core/musician/application/use-cases/common/musician-profile-output";
import {
  MusicianCardPresenter,
  MusicianIdentityPresenter,
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
    presentation_audio: null,
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
    accepts_requests_outside_repertoire: true,
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

/*
 * 🔴 O `Location` do músico é o endereço de CASA de uma pessoa (o app preenche
 * por CEP). Até out/2026 o presenter público copiava `profile` inteiro, e
 * `GET /musicians` — anônima — entregava rua, número, CEP e coordenada exata
 * de cada artista. Nenhum cliente lia: web e app só mostram cidade e estado.
 */
describe("PublicMusicianPresenter — o que do perfil sai para terceiros", () => {
  const profile: NonNullable<MusicianOutput["profile"]> = {
    id: "5a3e8f7b-4d0f-4a55-9d0d-0a2f6a7b9c01",
    musician_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
    price_ranges: [
      {
        model: "per_hour",
        min: 150,
        max: 280,
        currency: "BRL" as any,
        notes: null,
      },
    ],
    location: {
      city: "Curitiba",
      state: "PR",
      latitude: -25.42896,
      longitude: -49.26713,
      street: "Rua XV de Novembro",
      number: "1742-K",
      complement: "apto 71",
      neighborhood: "Batel",
      zip_code: "80020310",
    },
    touring_location: null,
    touring_expires_at: null,
    is_touring: false,
    social_links: { instagram: "@mari" },
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-01T00:00:00.000Z"),
  };

  it("não leva rua, número, complemento, bairro nem CEP", () => {
    const json = JSON.stringify(
      new PublicMusicianPresenter(makeOutput({ profile })),
    );

    for (const leaked of [
      "Rua XV de Novembro",
      "1742-K",
      "apto 71",
      "Batel",
      "80020310",
    ]) {
      expect(json).not.toContain(leaked);
    }
  });

  /*
   * Nenhuma coordenada sai, nem arredondada: quem precisa de "a X km" manda a
   * própria posição na busca e recebe `distance_km` (ver o cartão de lista).
   */
  it("leva cidade e estado, e NENHUMA coordenada", () => {
    const presenter = new PublicMusicianPresenter(makeOutput({ profile }));
    const json = JSON.stringify(presenter);

    expect(presenter.profile!.location).toStrictEqual({
      city: "Curitiba",
      state: "PR",
    });
    for (const leaked of ["25.42", "49.26", "latitude", "longitude"]) {
      expect(json).not.toContain(leaked);
    }
  });

  it("mantém preço e redes, que a tela de terceiros usa", () => {
    const presenter = new PublicMusicianPresenter(makeOutput({ profile }));

    expect(presenter.profile!.price_ranges).toStrictEqual(profile.price_ranges);
    expect(presenter.profile!.social_links).toStrictEqual({
      instagram: "@mari",
    });
  });

  it("não leva ids internos nem datas do perfil", () => {
    const presenter = new PublicMusicianPresenter(makeOutput({ profile }));

    expect(Object.keys(presenter.profile!).sort()).toStrictEqual([
      "is_touring",
      "location",
      "price_ranges",
      "social_links",
      "touring_expires_at",
      "touring_location",
    ]);
  });

  it("turnê vigente sai só com cidade e estado", () => {
    const expiresAt = new Date("2026-12-31T00:00:00.000Z");
    const presenter = new PublicMusicianPresenter(
      makeOutput({
        profile: {
          ...profile,
          is_touring: true,
          touring_expires_at: expiresAt,
          touring_location: {
            city: "Recife",
            state: "PE",
            latitude: -8.04756,
            longitude: -34.877,
            street: "Rua da Aurora",
            number: "12",
            complement: null,
            neighborhood: "Boa Vista",
            zip_code: "50050000",
          },
        },
      }),
    );

    expect(presenter.profile!.touring_location).toStrictEqual({
      city: "Recife",
      state: "PE",
    });
    expect(presenter.profile!.touring_expires_at).toBe(expiresAt);
    expect(JSON.stringify(presenter)).not.toContain("Rua da Aurora");
  });

  it("turnê EXPIRADA não revela por onde o músico passou", () => {
    const presenter = new PublicMusicianPresenter(
      makeOutput({
        profile: {
          ...profile,
          is_touring: false,
          touring_expires_at: new Date("2026-01-02T00:00:00.000Z"),
          touring_location: {
            ...profile.location,
            city: "Recife",
            state: "PE",
          },
        },
      }),
    );

    expect(presenter.profile!.touring_location).toBeNull();
    expect(presenter.profile!.touring_expires_at).toBeNull();
    expect(JSON.stringify(presenter)).not.toContain("Recife");
  });

  it("músico sem profile sai com profile nulo", () => {
    expect(new PublicMusicianPresenter(makeOutput()).profile).toBeNull();
  });

  it("o DONO continua recebendo o endereço completo", () => {
    const presenter = new MusicianPresenter(makeOutput({ profile }));

    expect(presenter.profile).toBe(profile);
    expect(presenter.profile!.location.street).toBe("Rua XV de Novembro");
  });
});

describe("plan_tier — dado comercial do artista", () => {
  it("o dono recebe", () => {
    expect(
      new MusicianPresenter(makeOutput({ plan_tier: "pro" })).plan_tier,
    ).toBe("pro");
  });

  it("terceiro não recebe, mesmo que o output traga", () => {
    const presenter = new PublicMusicianPresenter(
      makeOutput({ plan_tier: "pro" }),
    );

    expect(presenter).not.toHaveProperty("plan_tier");
    expect(JSON.stringify(presenter)).not.toContain("plan_tier");
  });
});

/*
 * O cartão é o que as LISTAS devolvem (busca, faixa em destaque). Allowlist:
 * campo novo no output não entra por herança.
 */
describe("MusicianCardPresenter — o item de lista", () => {
  const output = makeOutput({
    qr_code: "https://soundmeet.com.br/musico/x",
    plan_tier: "pro",
    profile: {
      id: "5a3e8f7b-4d0f-4a55-9d0d-0a2f6a7b9c01",
      musician_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
      price_ranges: [],
      location: {
        city: "Curitiba",
        state: "PR",
        latitude: -25.42896,
        longitude: -49.26713,
        street: "Rua XV de Novembro",
        number: "1742-K",
        complement: null,
        neighborhood: "Batel",
        zip_code: "80020310",
      },
      touring_location: null,
      touring_expires_at: null,
      is_touring: false,
      social_links: null,
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      updated_at: new Date("2026-01-01T00:00:00.000Z"),
    },
  });

  it("tem exatamente os campos que as telas de lista leem", () => {
    expect(Object.keys(new MusicianCardPresenter(output)).sort()).toStrictEqual(
      [
        "avatar",
        "bio",
        "display_name",
        "distance_km",
        "experience_years",
        "genres",
        "id",
        "instruments",
        "is_active",
        "is_highly_rated",
        "is_verified",
        "name",
        "open_to_gigs",
        "presentation_audio",
        "profile",
        "rating",
        "stage_name",
        "total_ratings",
        "updated_at",
      ],
    );
  });

  it("não leva contato, endereço, coordenada, QR nem plano", () => {
    const json = JSON.stringify(new MusicianCardPresenter(output));

    for (const leaked of [
      "musico@example.com",
      "+5511999999999",
      "11222333000181",
      "Rua XV de Novembro",
      "1742-K",
      "80020310",
      "25.42",
      "qr_code",
      "plan_tier",
    ]) {
      expect(json).not.toContain(leaked);
    }
  });

  it("leva a distância que a busca calculou", () => {
    expect(
      new MusicianCardPresenter({ ...output, distance_km: 3 }).distance_km,
    ).toBe(3);
  });

  it("sem distância no output, sai null — nunca zero", () => {
    expect(new MusicianCardPresenter(output).distance_km).toBeNull();
  });

  it("zero é uma distância válida (mesma célula), não ausência", () => {
    expect(
      new MusicianCardPresenter({ ...output, distance_km: 0 }).distance_km,
    ).toBe(0);
  });
});

describe("MusicianIdentityPresenter", () => {
  it("copia a identidade campo a campo", () => {
    const identity = {
      id: "9366b7dc-2d71-4799-b91c-c64adb205104",
      display_name: "Carlão do Piano",
      avatar: null,
      instruments: ["Piano"],
      genres: ["Jazz"],
      rating: 4.8,
      total_ratings: 27,
      is_verified: true,
    };

    expect({ ...new MusicianIdentityPresenter(identity) }).toStrictEqual(
      identity,
    );
  });

  it("ignora o que vier a mais no output", () => {
    const presenter = new MusicianIdentityPresenter({
      id: "9366b7dc-2d71-4799-b91c-c64adb205104",
      display_name: "Carlão do Piano",
      avatar: null,
      instruments: [],
      genres: [],
      rating: 0,
      total_ratings: 0,
      is_verified: false,
      email: "vazou@example.com",
    } as any);

    expect(presenter).not.toHaveProperty("email");
  });
});
