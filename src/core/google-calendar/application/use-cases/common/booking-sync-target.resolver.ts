import { BandId } from "../../../../musician/domain/band.aggregate";
import { IBandRepository } from "../../../../musician/domain/band.repository";
import { Booking } from "../../../../scheduling/domain/booking.aggregate";

/**
 * Resolve o músico dono da agenda a sincronizar: o próprio músico do booking
 * ou, em booking de banda, o líder (`role === "leader"` em Band.members —
 * decisão de produto: só a conta do líder sincroniza, nunca a de cada membro).
 * Retorna null quando não há alvo (banda sem líder / banda inexistente).
 */
export async function resolveBookingSyncMusicianId(
  booking: Booking,
  bandRepo: IBandRepository,
): Promise<string | null> {
  if (booking.musician_id) {
    return booking.musician_id.id;
  }

  if (!booking.band_id) {
    return null;
  }

  const band = await bandRepo.findById(new BandId(booking.band_id.id));
  if (!band) {
    return null;
  }

  // Só um líder com convite aceito pode ser dono da sincronização — um
  // convite pending/declined com role "leader" nunca deu consentimento para
  // ter a própria agenda associada à banda.
  const leader = band.acceptedMembers.find(
    (member) => member.role === "leader",
  );
  return leader ? leader.musician_id.id : null;
}
