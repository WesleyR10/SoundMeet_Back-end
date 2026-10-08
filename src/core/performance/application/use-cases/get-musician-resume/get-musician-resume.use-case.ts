import { EstablishmentId } from "../../../../establishment/domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../../establishment/domain/establishment.repository";
import { IEventAttendeeRepository } from "../../../../events/domain/event-attendee.repository";
import {
  BandSearchParams,
  IBandRepository,
} from "../../../../musician/domain/band.repository";
import {
  Musician,
  MusicianId,
} from "../../../../musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../../../musician/domain/musician.repository";
import { IReviewRepository } from "../../../../review/domain/review.repository";
import { Booking } from "../../../../scheduling/domain/booking.aggregate";
import {
  BookingSearchParams,
  IBookingRepository,
} from "../../../../scheduling/domain/booking.repository";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { BookingStatusEnum } from "../../../../shared/domain/value-objects/booking-status.vo";
import { IPerformanceRepository } from "../../../domain/performance.repository";

/** Um currículo com mais que isso vira lista, não vitrine. */
const MAX_VENUES_LISTED = 12;

/** Teto de bookings lidos. Acima disso os números viram "N+" na UI. */
const BOOKINGS_PAGE_SIZE = 500;

export type GetMusicianResumeInput = {
  musician_id: string;
};

export type ResumeVenueOutput = {
  establishment_id: string;
  name: string;
  shows_count: number;
  last_show_at: Date;
};

export type GetMusicianResumeOutput = {
  musician_id: string;

  /** Bookings concluídos — próprios e das bandas onde é membro aceito. */
  shows_completed: number;
  /** Subconjunto com check-in do artista: prova de execução, não só de agenda. */
  shows_with_checkin: number;

  distinct_venues: number;
  venues: ResumeVenueOutput[];

  /** Pessoas distintas presentes nos eventos desses shows. */
  audience_reached: number;

  rating_average: number;
  rating_total: number;

  /** Só cresce a partir do subsistema `performance`. Ver a nota abaixo. */
  distinct_songs_performed: number;

  first_show_at: Date | null;
  last_show_at: Date | null;
  months_active: number;
};

/**
 * Currículo verificado do músico (F4).
 *
 * 🔴 **A regra que define a feature: currículo é derivado, nunca declarado.** O
 * músico não escreve uma linha dele. É isso — e só isso — que o separa da bio,
 * que já existe e já aceita qualquer coisa. Cada número aqui tem uma prova
 * rastreável: `Booking.completed_at`, `Booking.checked_in_at`, `EventAttendee`,
 * `Review`, `PerformedSong`.
 *
 * ## Duas decisões de privacidade
 *
 * O currículo aparece **também no perfil público** que o fã abre, então:
 *
 * - 🔴 **Nenhum valor de cachê sai daqui.** `Booking.fee` é dado comercial
 *   entre as partes; expor "média de R$ 380 por show" num perfil público
 *   destruiria a posição de negociação do músico com o próximo contratante, e
 *   ele nunca pediu isso. O campo não existe no output — não é filtrado no
 *   presenter, é ausente na origem, para que nenhum presenter futuro possa
 *   deixá-lo escapar.
 * - **Nome de local sai; nome de fã não.** O estabelecimento é PJ com perfil
 *   público próprio; o público alcançado sai como número agregado.
 *
 * ## Limite conhecido
 *
 * `distinct_songs_performed` começa em zero e cresce: shows anteriores ao
 * subsistema `performance` não têm `PerformedSong`. Os demais itens são
 * retroativos, porque `Booking`/`Review`/`EventAttendee` já existiam. Preferir
 * um zero honesto a estimar o número a partir do repertório — repertório é o
 * que se sabe tocar, e o currículo só afirma o que se tocou.
 */
export class GetMusicianResumeUseCase implements IUseCase<
  GetMusicianResumeInput,
  GetMusicianResumeOutput
> {
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    private readonly bandRepo: IBandRepository,
    private readonly bookingRepo: IBookingRepository,
    private readonly establishmentRepo: IEstablishmentRepository,
    private readonly attendeeRepo: IEventAttendeeRepository,
    private readonly reviewRepo: IReviewRepository,
    private readonly performanceRepo: IPerformanceRepository,
  ) {}

  async execute(
    input: GetMusicianResumeInput,
  ): Promise<GetMusicianResumeOutput> {
    const musician = await this.musicianRepo.findById(
      new MusicianId(input.musician_id),
    );

    if (!musician) {
      throw new NotFoundError(input.musician_id, Musician);
    }

    // Shows de banda contam. Um músico que roda o ano inteiro numa banda tem
    // currículo, e ignorá-lo porque a reserva está no nome do grupo puniria
    // exatamente quem toca mais.
    const bandIds = await this.findAcceptedBandIds(input.musician_id);

    const bookings = await this.findCompletedBookings([
      input.musician_id,
      ...bandIds,
    ]);

    const eventIds = Array.from(
      new Set(
        bookings.map((b) => b.event_id?.id).filter((id): id is string => !!id),
      ),
    );

    const [audienceReached, rating, distinctSongs, venues] = await Promise.all([
      this.attendeeRepo.countDistinctAudienceByEvents(eventIds),
      this.reviewRepo.aggregateForTarget({
        target_type: "musician",
        target_id: input.musician_id,
      }),
      this.performanceRepo.countDistinctSongsByMusician(input.musician_id),
      this.buildVenues(bookings),
    ]);

    const dates = bookings
      .map((b) => b.completed_at ?? b.start_at)
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime());

    const firstShowAt = dates[0] ?? null;
    const lastShowAt = dates[dates.length - 1] ?? null;

    return {
      musician_id: input.musician_id,

      shows_completed: bookings.length,
      shows_with_checkin: bookings.filter((b) => !!b.checked_in_at).length,

      distinct_venues: new Set(bookings.map((b) => b.establishment_id.id)).size,
      venues,

      audience_reached: audienceReached,

      rating_average: rating.average,
      rating_total: rating.total,

      distinct_songs_performed: distinctSongs,

      first_show_at: firstShowAt,
      last_show_at: lastShowAt,
      months_active: this.monthsBetween(firstShowAt, lastShowAt),
    };
  }

  private async findAcceptedBandIds(musician_id: string): Promise<string[]> {
    // `BandFilter.musician_id` já significa "bandas onde sou membro ACEITO" —
    // convite pendente não vira currículo.
    const result = await this.bandRepo.search(
      BandSearchParams.create({
        page: 1,
        per_page: 50,
        filter: { musician_id },
      }),
    );
    return result.items.map((band) => band.band_id.id);
  }

  private async findCompletedBookings(participantIds: string[]) {
    // `participant_ids` casa em OR contra musician_id/band_id do booking. Array
    // vazio significa "nenhuma identidade" e resulta em zero linhas — nunca em
    // "todos". Aqui ele nunca é vazio (contém ao menos o próprio músico), mas a
    // garantia mora no repositório.
    const result = await this.bookingRepo.search(
      BookingSearchParams.create({
        page: 1,
        per_page: BOOKINGS_PAGE_SIZE,
        filter: {
          participant_ids: participantIds,
          status: BookingStatusEnum.COMPLETED,
        },
      }),
    );
    return result.items;
  }

  private async buildVenues(bookings: Booking[]): Promise<ResumeVenueOutput[]> {
    const byVenue = new Map<string, { count: number; last: Date }>();

    for (const booking of bookings) {
      const id = booking.establishment_id.id;
      const when = booking.completed_at ?? booking.start_at;
      const existing = byVenue.get(id);

      if (!existing) {
        byVenue.set(id, { count: 1, last: when });
        continue;
      }

      existing.count += 1;
      if (when > existing.last) existing.last = when;
    }

    const top = Array.from(byVenue.entries())
      .sort((a, b) => b[1].count - a[1].count || +b[1].last - +a[1].last)
      .slice(0, MAX_VENUES_LISTED);

    const establishments = await this.establishmentRepo.findByIds(
      top.map(([id]) => new EstablishmentId(id)),
    );
    const nameById = new Map(
      establishments.map((e) => [e.establishment_id.id, e.name]),
    );

    return (
      top
        // Local apagado sai da lista em vez de virar "Estabelecimento removido":
        // o currículo é vitrine, e uma linha sem nome não prova nada.
        .filter(([id]) => nameById.has(id))
        .map(([id, stats]) => ({
          establishment_id: id,
          name: nameById.get(id)!,
          shows_count: stats.count,
          last_show_at: stats.last,
        }))
    );
  }

  private monthsBetween(from: Date | null, to: Date | null): number {
    if (!from || !to) return 0;
    const months =
      (to.getFullYear() - from.getFullYear()) * 12 +
      (to.getMonth() - from.getMonth());
    // Um único show é "1 mês de estrada", não zero — zero leria como inativo.
    return Math.max(1, months + 1);
  }
}
