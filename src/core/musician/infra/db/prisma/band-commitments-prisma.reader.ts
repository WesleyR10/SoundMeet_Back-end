import { PrismaClient } from "@prisma/client";

import { BandId } from "../../../domain/band.aggregate";
import {
  BandCommitments,
  IBandCommitmentsReader,
} from "../../../domain/band-commitments.reader";

/**
 * Contagens diretas nas tabelas que referenciam `bands.id`.
 *
 * ⚠️ Toda tabela nova com `bandId` tem de entrar em `has_history`. Se faltar
 * uma, dissolver uma banda que só aparece nela APAGA a linha da banda e o
 * `ON DELETE SET NULL` deixa o registro apontando para ninguém — é o defeito
 * que este leitor existe para impedir.
 */
export class BandCommitmentsPrismaReader implements IBandCommitmentsReader {
  constructor(private readonly prisma: PrismaClient) {}

  async summarize(band_id: BandId, now: Date): Promise<BandCommitments> {
    const bandId = band_id.id;
    const select = { id: true } as const;

    const [
      upcoming_bookings,
      open_inquiries,
      held_escrows,
      live_performances,
      booking,
      inquiry,
      lineup,
      tip,
      transaction,
      contract,
      performance,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: {
          bandId,
          status: { in: ["pending", "confirmed"] },
          end_at: { gt: now },
        },
      }),
      this.prisma.inquiry.count({
        where: {
          bandId,
          status: { in: ["open", "accepted"] },
          OR: [{ expires_at: null }, { expires_at: { gt: now } }],
        },
      }),
      // `pending` (cobrança emitida), `held` (dinheiro retido) e `disputed`
      // (contestação aberta): nos três o cachê ainda não teve destino.
      this.prisma.bookingEscrow.count({
        where: {
          status: { in: ["pending", "held", "disputed"] },
          booking: { bandId },
        },
      }),
      this.prisma.performance.count({ where: { bandId, status: "live" } }),
      this.prisma.booking.findFirst({ where: { bandId }, select }),
      this.prisma.inquiry.findFirst({ where: { bandId }, select }),
      this.prisma.eventMusician.findFirst({ where: { bandId }, select }),
      this.prisma.tip.findFirst({ where: { bandId }, select }),
      this.prisma.transaction.findFirst({ where: { bandId }, select }),
      this.prisma.contract.findFirst({ where: { bandId }, select }),
      this.prisma.performance.findFirst({ where: { bandId }, select }),
    ]);

    return {
      open: {
        upcoming_bookings,
        open_inquiries,
        held_escrows,
        live_performances,
      },
      has_history: [
        booking,
        inquiry,
        lineup,
        tip,
        transaction,
        contract,
        performance,
      ].some((row) => row !== null),
    };
  }
}
