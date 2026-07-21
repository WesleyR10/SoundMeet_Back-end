import { Location } from "../../../../../shared/domain/value-objects/location.vo";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianSearchParams } from "../../../../domain/musician.repository";
import { MusicianInMemoryRepository } from "../musician-in-memory.repository";

// Busca por raio (7.13c) — espelho in-memory do searchByProximity do Prisma.
// Coordenadas reais: Av. Paulista (SP), Pinheiros (SP ~4km), Centro (RJ ~360km).
const PAULISTA = { latitude: -23.5614, longitude: -46.6559 };
const PINHEIROS = { latitude: -23.5662, longitude: -46.6825 };
const RIO = { latitude: -22.9035, longitude: -43.1771 };

function musicianAt(
  name: string,
  coords: { latitude: number; longitude: number } | null,
): Musician {
  const musician = Musician.fake().aMusician().withName(name).build();
  const profile = musician.ensureProfile();
  profile.changeLocation(
    new Location({
      city: "Cidade",
      state: "UF",
      ...(coords ?? {}),
    }),
  );
  return musician;
}

describe("MusicianInMemoryRepository — busca por raio (7.13c)", () => {
  let repository: MusicianInMemoryRepository;

  beforeEach(async () => {
    repository = new MusicianInMemoryRepository();
    await repository.insert(musicianAt("Paulista", PAULISTA));
    await repository.insert(musicianAt("Pinheiros", PINHEIROS));
    await repository.insert(musicianAt("Rio", RIO));
    await repository.insert(musicianAt("Sem Coordenadas", null));
  });

  it("retorna só músicos dentro do raio", async () => {
    const result = await repository.search(
      MusicianSearchParams.create({
        filter: { lat: PAULISTA.latitude, lng: PAULISTA.longitude, radius_km: 5 },
      }),
    );

    const names = result.items.map((m) => m.name).sort();
    expect(names).toStrictEqual(["Paulista", "Pinheiros"]);
  });

  it("exclui músicos sem coordenadas no perfil", async () => {
    const result = await repository.search(
      MusicianSearchParams.create({
        filter: { lat: PAULISTA.latitude, lng: PAULISTA.longitude, radius_km: 500 },
      }),
    );

    const names = result.items.map((m) => m.name);
    expect(names).not.toContain("Sem Coordenadas");
    expect(result.total).toBe(3);
  });

  it("coage strings de query e sanitiza raio acima de 500km", () => {
    const params = MusicianSearchParams.create({
      filter: {
        lat: "-23.5614",
        lng: "-46.6559",
        radius_km: "9999",
      } as any,
    });

    expect(params.filter).toMatchObject({
      lat: -23.5614,
      lng: -46.6559,
      radius_km: 500,
    });
  });

  it("ignora o trio geo incompleto (sem radius_km)", () => {
    const params = MusicianSearchParams.create({
      filter: { lat: -23.5614, lng: -46.6559 } as any,
    });

    expect(params.filter).toBeNull();
  });
});

describe("MusicianInMemoryRepository — modo turnê (7.13d)", () => {
  let repository: MusicianInMemoryRepository;

  const buildTouringMusician = (
    name: string,
    home: { latitude: number; longitude: number } | null,
    touring:
      | { location: { latitude: number; longitude: number }; expires_at: Date }
      | null,
  ): Musician => {
    const musician = Musician.fake().aMusician().withName(name).build();
    const profile = musician.ensureProfile();
    profile.changeLocation(new Location({ city: "Base", state: "UF", ...(home ?? {}) }));
    if (touring) {
      profile.setTouringLocation(
        new Location({ city: "Turnê", state: "UF", ...touring.location }),
        touring.expires_at,
      );
    }
    return musician;
  };

  beforeEach(async () => {
    repository = new MusicianInMemoryRepository();
  });

  it("encontra o músico pelo ponto de turnê ativo mesmo com a base longe", async () => {
    await repository.insert(
      buildTouringMusician("Em Turnê", RIO, {
        location: PAULISTA,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    );

    const result = await repository.search(
      MusicianSearchParams.create({
        filter: { lat: PAULISTA.latitude, lng: PAULISTA.longitude, radius_km: 5 },
      }),
    );

    expect(result.items.map((m) => m.name)).toStrictEqual(["Em Turnê"]);
  });

  it("continua encontrando o músico pela base mesmo com turnê ativo em outro lugar", async () => {
    await repository.insert(
      buildTouringMusician("Em Turnê", PAULISTA, {
        location: RIO,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    );

    const result = await repository.search(
      MusicianSearchParams.create({
        filter: { lat: PAULISTA.latitude, lng: PAULISTA.longitude, radius_km: 5 },
      }),
    );

    expect(result.items.map((m) => m.name)).toStrictEqual(["Em Turnê"]);
  });

  it("ignora ponto de turnê expirado", async () => {
    await repository.insert(
      buildTouringMusician("Turnê Expirado", RIO, {
        location: PAULISTA,
        expires_at: new Date(Date.now() - 1000),
      }),
    );

    const result = await repository.search(
      MusicianSearchParams.create({
        filter: { lat: PAULISTA.latitude, lng: PAULISTA.longitude, radius_km: 5 },
      }),
    );

    expect(result.items).toHaveLength(0);
  });

  it("não retorna o músico se nem base nem turnê ativo estão dentro do raio", async () => {
    await repository.insert(buildTouringMusician("Fora do Raio", RIO, null));

    const result = await repository.search(
      MusicianSearchParams.create({
        filter: { lat: PAULISTA.latitude, lng: PAULISTA.longitude, radius_km: 5 },
      }),
    );

    expect(result.items).toHaveLength(0);
  });
});
