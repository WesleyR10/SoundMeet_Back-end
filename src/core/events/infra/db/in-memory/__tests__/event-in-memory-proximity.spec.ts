import { Establishment } from "../../../../../establishment/domain/establishment.aggregate";
import { EstablishmentInMemoryRepository } from "../../../../../establishment/infra/db/in-memory/establishment-in-memory.repository";
import { Address } from "../../../../../shared/domain/value-objects/address.vo";
import { Event, EventId } from "../../../../domain";
import { EventSearchParams } from "../../../../domain/event.repository";
import { EventInMemoryRepository } from "../event-in-memory.repository";

// Busca por raio (7.13b) — espelho in-memory do searchByProximity do Prisma,
// mas com join-through: Event não tem lat/lng próprio, herda de
// establishment_id → Establishment.profile.location.
const PAULISTA = { latitude: -23.5614, longitude: -46.6559 };
const PINHEIROS = { latitude: -23.5662, longitude: -46.6825 };
const RIO = { latitude: -22.9035, longitude: -43.1771 };

function establishmentAt(
  name: string,
  coords: { latitude: number; longitude: number } | null,
): Establishment {
  const establishment = Establishment.fake().aEstablishment().withName(name).build();
  establishment.ensureProfile(
    new Address({
      street: "Rua Teste",
      number: "100",
      neighborhood: "Bairro",
      city: "Cidade",
      state: "UF",
      zipCode: "01000000",
      ...(coords ?? {}),
    }),
  );
  return establishment;
}

function eventFor(establishment: Establishment, name: string): Event {
  const now = new Date();
  return Event.create({
    establishment_id: establishment.establishment_id.id,
    name,
    start_at: new Date(now.getTime() + 60 * 60 * 1000),
    end_at: new Date(now.getTime() + 2 * 60 * 60 * 1000),
    is_public: true,
  });
}

describe("EventInMemoryRepository — busca por raio (7.13b)", () => {
  let establishmentRepo: EstablishmentInMemoryRepository;
  let paulista: Establishment;
  let pinheiros: Establishment;
  let rio: Establishment;
  let semCoordenadas: Establishment;

  beforeEach(async () => {
    establishmentRepo = new EstablishmentInMemoryRepository();
    paulista = establishmentAt("Paulista", PAULISTA);
    pinheiros = establishmentAt("Pinheiros", PINHEIROS);
    rio = establishmentAt("Rio", RIO);
    semCoordenadas = establishmentAt("Sem Coordenadas", null);
    await establishmentRepo.insert(paulista);
    await establishmentRepo.insert(pinheiros);
    await establishmentRepo.insert(rio);
    await establishmentRepo.insert(semCoordenadas);
  });

  it("retorna só eventos cujo estabelecimento está dentro do raio", async () => {
    const repository = new EventInMemoryRepository(establishmentRepo);
    await repository.insert(eventFor(paulista, "Show Paulista"));
    await repository.insert(eventFor(pinheiros, "Show Pinheiros"));
    await repository.insert(eventFor(rio, "Show Rio"));
    await repository.insert(eventFor(semCoordenadas, "Show Sem Coordenadas"));

    const result = await repository.search(
      EventSearchParams.create({
        filter: { lat: PAULISTA.latitude, lng: PAULISTA.longitude, radius_km: 5 },
      }),
    );

    const names = result.items.map((e) => e.name).sort();
    expect(names).toStrictEqual(["Show Paulista", "Show Pinheiros"]);
  });

  it("exclui eventos de estabelecimento sem coordenadas", async () => {
    const repository = new EventInMemoryRepository(establishmentRepo);
    await repository.insert(eventFor(paulista, "Show Paulista"));
    await repository.insert(eventFor(semCoordenadas, "Show Sem Coordenadas"));

    const result = await repository.search(
      EventSearchParams.create({
        filter: { lat: PAULISTA.latitude, lng: PAULISTA.longitude, radius_km: 500 },
      }),
    );

    const names = result.items.map((e) => e.name);
    expect(names).not.toContain("Show Sem Coordenadas");
  });

  it("lança erro explícito quando establishmentRepo não foi injetado", async () => {
    const repository = new EventInMemoryRepository();
    await repository.insert(eventFor(paulista, "Show Paulista"));

    await expect(
      repository.search(
        EventSearchParams.create({
          filter: { lat: PAULISTA.latitude, lng: PAULISTA.longitude, radius_km: 5 },
        }),
      ),
    ).rejects.toThrow(
      "EventInMemoryRepository requires establishmentRepo to filter by proximity",
    );
  });

  it("continua funcionando sem establishmentRepo quando não há filtro geo", async () => {
    const repository = new EventInMemoryRepository();
    await repository.insert(eventFor(paulista, "Show Paulista"));

    const result = await repository.search(
      EventSearchParams.create({ filter: { establishment_id: paulista.establishment_id.id } }),
    );

    expect(result.items.map((e) => e.name)).toStrictEqual(["Show Paulista"]);
  });
});
