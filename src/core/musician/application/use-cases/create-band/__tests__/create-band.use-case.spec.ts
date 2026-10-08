import { MusicianId } from "@core/musician/domain";
import { EntityValidationError } from "@core/shared/domain/validators/validation.error";
import { Currency } from "@core/shared/domain/value-objects/money.vo";
import { FakeGeocodingService } from "@core/shared/infra/geocoding/fake-geocoding.service";

import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { CreateBandInput } from "../create-band.input";
import { CreateBandUseCase } from "../create-band.use-case";

describe("CreateBandUseCase Unit Tests", () => {
  let useCase: CreateBandUseCase;
  let repository: BandInMemoryRepository;
  let geocoding: FakeGeocodingService;
  const creator = new MusicianId().id;

  beforeEach(() => {
    repository = new BandInMemoryRepository();
    geocoding = new FakeGeocodingService();
    useCase = new CreateBandUseCase(repository, undefined, geocoding);
  });

  it("cria a banda com quem a criou como líder aceito", async () => {
    const output = await useCase.execute(
      new CreateBandInput({
        name: "test band",
        genres: ["rock"],
        creator_musician_id: creator,
      }),
    );

    expect(output).toStrictEqual({
      id: expect.any(String),
      name: "test band",
      description: null,
      formed_in: null,
      avatar: null,
      genres: ["rock"],
      members: [
        {
          member_id: expect.any(String),
          musician_id: creator,
          role: "leader",
          instrument: "N/A",
          status: "accepted",
          joined_at: expect.any(Date),
          responded_at: expect.any(Date),
        },
      ],
      priceRange: null,
      address: null,
      open_to_gigs: null,
      is_active: true,
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
    expect(repository.items).toHaveLength(1);
  });

  it("grava descrição, ano de formação e faixa de preço", async () => {
    const output = await useCase.execute(
      new CreateBandInput({
        name: "test band",
        description: "test description",
        formed_in: 2019,
        genres: ["rock"],
        priceRange: {
          model: "per_hour",
          min: 100,
          max: 200,
          currency: Currency.BRL,
          notes: "negotiable",
        },
        creator_musician_id: creator,
      }),
    );

    expect(output).toMatchObject({
      description: "test description",
      formed_in: 2019,
      priceRange: {
        model: "per_hour",
        min: 100,
        max: 200,
        currency: "BRL",
        notes: "negotiable",
      },
      // Banda nunca nasce no radar: é consentimento, decidido depois.
      open_to_gigs: null,
      is_active: true,
    });
  });

  it("🔴 não cria banda sem líder — ninguém conseguiria administrá-la", async () => {
    await expect(
      useCase.execute(new CreateBandInput({ name: "órfã", genres: ["rock"] })),
    ).rejects.toThrow(EntityValidationError);
    expect(repository.items).toHaveLength(0);
  });

  it("faixa de preço invertida vira erro de validação, não exceção crua", async () => {
    await expect(
      useCase.execute(
        new CreateBandInput({
          name: "test band",
          genres: ["rock"],
          priceRange: { model: "per_event", min: 500, max: 100 },
          creator_musician_id: creator,
        }),
      ),
    ).rejects.toThrow(EntityValidationError);
  });

  it("geocodifica o endereço para a banda entrar na busca por raio", async () => {
    geocoding.setCoordinates({ latitude: -23.55, longitude: -46.63 });

    const output = await useCase.execute(
      new CreateBandInput({
        name: "test band",
        genres: ["rock"],
        address: { city: "São Paulo", state: "SP", zip_code: "01310-100" },
        creator_musician_id: creator,
      }),
    );

    expect(geocoding.queries).toHaveLength(1);
    expect(output.address).toMatchObject({
      city: "São Paulo",
      latitude: -23.55,
      longitude: -46.63,
      zip_code: "01310100",
    });
  });
});
