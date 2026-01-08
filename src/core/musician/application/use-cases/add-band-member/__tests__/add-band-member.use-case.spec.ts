import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Band } from "../../../../domain/band.aggregate";
import { Musician } from "../../../../domain/musician.aggregate";
import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { AddBandMemberInput } from "../add-band-member.input";
import { AddBandMemberUseCase } from "../add-band-member.use-case";

describe("AddBandMemberUseCase Unit Tests", () => {
  let useCase: AddBandMemberUseCase;
  let bandRepo: BandInMemoryRepository;
  let musicianRepo: MusicianInMemoryRepository;

  beforeEach(() => {
    bandRepo = new BandInMemoryRepository();
    musicianRepo = new MusicianInMemoryRepository();
    useCase = new AddBandMemberUseCase(bandRepo, musicianRepo);
  });

  it("should add a member to a band", async () => {
    const band = Band.fake().aBand().build();
    const musician = Musician.fake().aMusician().build();
    bandRepo.items = [band];
    musicianRepo.items = [musician];

    const input = new AddBandMemberInput({
      band_id: band.band_id.id,
      musician_id: musician.musician_id.id,
      role: "member",
      instrument: "guitar",
    });

    const output = await useCase.execute(input);

    expect(output.members).toHaveLength(1);
    expect(output.members[0]).toMatchObject({
      musician_id: musician.musician_id.id,
      role: "member",
      instrument: "guitar",
    });
    expect(bandRepo.items[0].members).toHaveLength(1);
  });

  it("should throw error when band not found", async () => {
    const musician = Musician.fake().aMusician().build();
    musicianRepo.items = [musician];

    const input = new AddBandMemberInput({
      band_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
      musician_id: musician.musician_id.id,
      role: "member",
      instrument: "guitar",
    });

    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("should throw error when musician not found", async () => {
    const band = Band.fake().aBand().build();
    bandRepo.items = [band];

    const input = new AddBandMemberInput({
      band_id: band.band_id.id,
      musician_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
      role: "member",
      instrument: "guitar",
    });

    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("should throw error when member already exists", async () => {
    const band = Band.fake().aBand().build();
    const musician = Musician.fake().aMusician().build();
    band.addMember(musician.musician_id, "member", "guitar");
    bandRepo.items = [band];
    musicianRepo.items = [musician];

    const input = new AddBandMemberInput({
      band_id: band.band_id.id,
      musician_id: musician.musician_id.id,
      role: "member",
      instrument: "bass",
    });

    await expect(useCase.execute(input)).rejects.toThrow(EntityValidationError);
  });
});
