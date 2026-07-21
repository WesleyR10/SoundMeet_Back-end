import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Band } from "../../../../domain/band.aggregate";
import { Musician } from "../../../../domain/musician.aggregate";
import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { DeclineBandInviteUseCase } from "../decline-band-invite.use-case";

describe("DeclineBandInviteUseCase Unit Tests", () => {
  let useCase: DeclineBandInviteUseCase;
  let bandRepo: BandInMemoryRepository;

  beforeEach(() => {
    bandRepo = new BandInMemoryRepository();
    useCase = new DeclineBandInviteUseCase(bandRepo);
  });

  it("should decline a pending invite", async () => {
    const band = Band.fake().aBand().build();
    const musician = Musician.fake().aMusician().build();
    band.inviteMember(musician.musician_id, "member", "guitar");
    bandRepo.items = [band];

    const output = await useCase.execute({
      band_id: band.band_id.id,
      musician_id: musician.musician_id.id,
    });

    expect(output.members[0].status).toBe("declined");
    expect(bandRepo.items[0].acceptedMembers).toHaveLength(0);
  });

  it("should throw error when band not found", async () => {
    await expect(
      useCase.execute({
        band_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
        musician_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("should throw error when there is no invite for the musician", async () => {
    const band = Band.fake().aBand().build();
    bandRepo.items = [band];

    await expect(
      useCase.execute({
        band_id: band.band_id.id,
        musician_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
      }),
    ).rejects.toThrow(EntityValidationError);
  });
});
