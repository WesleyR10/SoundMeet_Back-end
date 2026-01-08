import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Band } from "../../../../domain/band.aggregate";
import { Musician } from "../../../../domain/musician.aggregate";
import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { RemoveBandMemberInput } from "../remove-band-member.input";
import { RemoveBandMemberUseCase } from "../remove-band-member.use-case";

describe("RemoveBandMemberUseCase Unit Tests", () => {
  let useCase: RemoveBandMemberUseCase;
  let repository: BandInMemoryRepository;

  beforeEach(() => {
    repository = new BandInMemoryRepository();
    useCase = new RemoveBandMemberUseCase(repository);
  });

  it("should remove a member from a band", async () => {
    const band = Band.fake().aBand().build();
    const musician = Musician.fake().aMusician().build();
    band.addMember(musician.musician_id, "member", "guitar");
    repository.items = [band];

    const input = new RemoveBandMemberInput({
      band_id: band.band_id.id,
      musician_id: musician.musician_id.id,
    });

    const output = await useCase.execute(input);

    expect(output.members).toHaveLength(0);
    expect(repository.items[0].members).toHaveLength(0);
  });

  it("should throw error when band not found", async () => {
    const input = new RemoveBandMemberInput({
      band_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
      musician_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
    });

    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("should throw error when member not in band", async () => {
    const band = Band.fake().aBand().build();
    repository.items = [band];

    const input = new RemoveBandMemberInput({
      band_id: band.band_id.id,
      musician_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
    });

    await expect(useCase.execute(input)).rejects.toThrow(EntityValidationError);
  });
});
