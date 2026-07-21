import { Band } from "../../../../../musician/domain/band.aggregate";
import { BandInMemoryRepository } from "../../../../../musician/infra/db/in-memory/band-in-memory.repository";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Booking } from "../../../../../scheduling/domain/booking.aggregate";
import { resolveBookingSyncMusicianId } from "../booking-sync-target.resolver";

describe("resolveBookingSyncMusicianId", () => {
  it("returns the booking's own musician_id for a solo booking", async () => {
    const bandRepo = new BandInMemoryRepository();
    const musicianId = new Uuid();
    const booking = Booking.fake()
      .aBooking()
      .pending()
      .withMusicianId(musicianId)
      .withBandId(null)
      .build();

    const result = await resolveBookingSyncMusicianId(booking, bandRepo);

    expect(result).toBe(musicianId.id);
  });

  it("returns the accepted leader's musician_id for a band booking", async () => {
    const bandRepo = new BandInMemoryRepository();
    const leaderId = new Uuid();
    const band = Band.create({ name: "The Band", genres: ["rock"] });
    band.inviteMember(leaderId, "leader", "vocals");
    band.acceptInvite(leaderId);
    await bandRepo.insert(band);

    const booking = Booking.fake()
      .aBooking()
      .pending()
      .withMusicianId(null)
      .withBandId(band.band_id)
      .build();

    const result = await resolveBookingSyncMusicianId(booking, bandRepo);

    expect(result).toBe(leaderId.id);
  });

  it("never syncs a musician invited as leader whose invite is still pending", async () => {
    const bandRepo = new BandInMemoryRepository();
    const pendingLeaderId = new Uuid();
    const band = Band.create({ name: "The Band", genres: ["rock"] });
    band.inviteMember(pendingLeaderId, "leader", "vocals");
    // Never accepted.
    await bandRepo.insert(band);

    const booking = Booking.fake()
      .aBooking()
      .pending()
      .withMusicianId(null)
      .withBandId(band.band_id)
      .build();

    const result = await resolveBookingSyncMusicianId(booking, bandRepo);

    expect(result).toBeNull();
  });

  it("returns null when the band has no accepted leader at all", async () => {
    const bandRepo = new BandInMemoryRepository();
    const band = Band.create({ name: "The Band", genres: ["rock"] });
    await bandRepo.insert(band);

    const booking = Booking.fake()
      .aBooking()
      .pending()
      .withMusicianId(null)
      .withBandId(band.band_id)
      .build();

    const result = await resolveBookingSyncMusicianId(booking, bandRepo);

    expect(result).toBeNull();
  });
});
