import { MusicianId } from "@core/musician/domain";
import { Currency } from "@core/shared/domain/value-objects/money.vo";

import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { CreateBandInput } from "../create-band.input";
import { CreateBandUseCase } from "../create-band.use-case";

describe("CreateBandUseCase Unit Tests", () => {
  let useCase: CreateBandUseCase;
  let repository: BandInMemoryRepository;

  beforeEach(() => {
    repository = new BandInMemoryRepository();
    useCase = new CreateBandUseCase(repository);
  });

  it("should create a band", async () => {
    const input = new CreateBandInput({
      name: "test band",
      genres: ["rock"],
      is_active: true,
    });

    const output = await useCase.execute(input);

    expect(output).toStrictEqual({
      id: expect.any(String),
      name: "test band",
      description: null,
      avatar: null,
      genres: ["rock"],
      members: [],
      priceRange: null,
      address: null,
      open_to_gigs: null,
      is_active: true,
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
    expect(repository.items).toHaveLength(1);
  });

  it("should create a band with full props, forcing non-creator members to pending", async () => {
    const musicianId = new MusicianId();
    const joinedAt = new Date();
    const input = new CreateBandInput({
      name: "test band",
      description: "test description",
      avatar: "test avatar",
      genres: ["rock"],
      members: [
        {
          member_id: undefined,
          musician_id: musicianId,
          role: "member",
          instrument: "vocalist",
          status: "accepted",
          joined_at: joinedAt,
          responded_at: null,
        },
      ],
      priceRange: {
        model: "per_hour",
        min: 100,
        max: 200,
        currency: Currency.BRL,
        notes: "negotiable",
      },
      is_active: false,
    });

    const output = await useCase.execute(input);

    expect(output).toStrictEqual({
      id: expect.any(String),
      name: "test band",
      description: "test description",
      avatar: "test avatar",
      genres: ["rock"],
      members: [
        {
          member_id: expect.any(String),
          musician_id: musicianId.id,
          role: "member",
          instrument: "vocalist",
          status: "pending",
          joined_at: expect.any(Date),
          responded_at: null,
        },
      ],
      priceRange: {
        model: "per_hour",
        min: 100,
        max: 200,
        currency: "BRL",
        notes: "negotiable",
      },
      address: null,
      open_to_gigs: null,
      is_active: false,
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
    expect(repository.items).toHaveLength(1);
  });

  it("never trusts a client-supplied status: accepted for non-creator members (consent bypass regression)", async () => {
    const musicianId = new MusicianId();
    const input = new CreateBandInput({
      name: "test band",
      genres: ["rock"],
      creator_musician_id: new MusicianId().id,
      members: [
        {
          musician_id: musicianId,
          role: "member",
          instrument: "guitar",
          status: "accepted",
          joined_at: new Date(),
          responded_at: new Date(),
        } as any,
      ],
    });

    const output = await useCase.execute(input);

    const nonCreatorMember = output.members.find(
      (m) => m.musician_id === musicianId.id,
    );
    expect(nonCreatorMember?.status).toBe("pending");
    expect(nonCreatorMember?.responded_at).toBeNull();
  });
});
