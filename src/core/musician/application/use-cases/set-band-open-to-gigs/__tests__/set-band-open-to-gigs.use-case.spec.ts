import { ForbiddenException } from "@nestjs/common";

import { InvalidOperationError } from "../../../../../shared/domain/errors/invalid-operation.error";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { bandLedBy, bandMember } from "../../common/__tests__/band-fixtures";
import { SetBandOpenToGigsUseCase } from "../set-band-open-to-gigs.use-case";

describe("SetBandOpenToGigsUseCase Unit Tests", () => {
  let useCase: SetBandOpenToGigsUseCase;
  let repository: BandInMemoryRepository;
  let leader: Uuid;

  beforeEach(() => {
    repository = new BandInMemoryRepository();
    useCase = new SetBandOpenToGigsUseCase(repository);
    leader = new Uuid();
  });

  it("should opt a band in, independent of member consent", async () => {
    const band = bandLedBy(leader);
    repository.items = [band];

    const output = await useCase.execute({
      band_id: band.band_id.id,
      open_to_gigs: true,
      requesting_musician_id: leader.id,
    });

    expect(output.open_to_gigs).toBe(true);
    expect(repository.items[0].open_to_gigs).toBe(true);
  });

  it("should opt a band out", async () => {
    const band = bandLedBy(leader);
    band.setOpenToGigs(true);
    repository.items = [band];

    const output = await useCase.execute({
      band_id: band.band_id.id,
      open_to_gigs: false,
      requesting_musician_id: leader.id,
    });

    expect(output.open_to_gigs).toBe(false);
  });

  it("🔴 o consentimento é do líder: integrante comum não põe a banda no radar", async () => {
    const member = new Uuid();
    const band = bandLedBy(leader, [bandMember(member)]);
    repository.items = [band];

    await expect(
      useCase.execute({
        band_id: band.band_id.id,
        open_to_gigs: true,
        requesting_musician_id: member.id,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(repository.items[0].open_to_gigs).toBeNull();
  });

  it("banda dissolvida não volta ao radar por esta porta", async () => {
    const band = bandLedBy(leader);
    band.archive();
    repository.items = [band];

    await expect(
      useCase.execute({
        band_id: band.band_id.id,
        open_to_gigs: true,
        requesting_musician_id: leader.id,
      }),
    ).rejects.toThrow(InvalidOperationError);
    expect(repository.items[0].open_to_gigs).toBe(false);
  });

  it("should throw error when band not found", async () => {
    await expect(
      useCase.execute({
        band_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
        open_to_gigs: true,
        requesting_musician_id: leader.id,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
