import { ForbiddenException } from "@nestjs/common";

import { Band, BandId } from "../../../../musician/domain/band.aggregate";
import { IBandRepository } from "../../../../musician/domain/band.repository";
import { BandInMemoryRepository } from "../../../../musician/infra/db/in-memory/band-in-memory.repository";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Booking } from "../../../domain/booking.aggregate";
import { Inquiry } from "../../../domain/inquiry.aggregate";
import { BookingInMemoryRepository } from "../../../infra/db/in-memory/booking-in-memory.repository";
import { InquiryInMemoryRepository } from "../../../infra/db/in-memory/inquiry-in-memory.repository";
import { AcceptInquiryUseCase } from "../accept-inquiry/accept-inquiry.use-case";
import { CancelBookingUseCase } from "../cancel-booking/cancel-booking.use-case";
import { ConfirmBookingUseCase } from "../confirm-booking/confirm-booking.use-case";
import { RejectInquiryUseCase } from "../reject-inquiry/reject-inquiry.use-case";

/**
 * Matriz de autorização das quatro operações de negociação.
 *
 * Dois eixos:
 *
 * 1. Identidade de estabelecimento e banda NÃO é o `sub` do JWT. Músico e
 *    público têm `aggregate_id == sub` (register.use-case.ts força o id), mas
 *    estabelecimento tem UUID próprio — uma conta pode ter até 3 deles — e o
 *    vínculo vive nos claims `establishment_ids` / `band_ids`. A versão
 *    anterior comparava um único `requesting_user_id` (o `sub`) contra
 *    `establishment_id`/`band_id`, o que nunca casava: estabelecimento e banda
 *    levavam 403 nas próprias operações.
 *
 * 2. Quando o lado é a banda, participar não basta: aceitar, recusar,
 *    confirmar ou cancelar compromete a agenda de todos os integrantes, então
 *    a decisão é do líder. O claim `band_ids` diz "faço parte", não "mando".
 */

const SUB_MUSICO = "11111111-1111-4111-8111-111111111111";
const SUB_DONO_ESTABELECIMENTO = "22222222-2222-4222-8222-222222222222";
const ESTABELECIMENTO_ID = "33333333-3333-4333-8333-333333333333";
const BANDA_ID = "44444444-4444-4444-8444-444444444444";
const SUB_LIDER_BANDA = "55555555-5555-4555-8555-555555555555";
const SUB_ESTRANHO = "66666666-6666-4666-8666-666666666666";
const SUB_INTEGRANTE_BANDA = "77777777-7777-4777-8777-777777777777";

// Espelha resolveParticipantIds(): sub + establishment_ids + band_ids.
const comoMusico = { ids: [SUB_MUSICO], sub: SUB_MUSICO };
const comoEstabelecimento = {
  ids: [SUB_DONO_ESTABELECIMENTO, ESTABELECIMENTO_ID],
  sub: SUB_DONO_ESTABELECIMENTO,
};
const comoLiderDaBanda = {
  ids: [SUB_LIDER_BANDA, BANDA_ID],
  sub: SUB_LIDER_BANDA,
};
const comoIntegranteDaBanda = {
  ids: [SUB_INTEGRANTE_BANDA, BANDA_ID],
  sub: SUB_INTEGRANTE_BANDA,
};
const comoEstranho = { ids: [SUB_ESTRANHO], sub: SUB_ESTRANHO };

type Ator = { ids: string[]; sub: string };

const dateTimeServiceStub = {
  addHours: (date: Date, hours: number) =>
    new Date(date.getTime() + hours * 3600_000),
} as never;

async function seedBandRepo(): Promise<IBandRepository> {
  const repo = new BandInMemoryRepository();
  await repo.insert(
    new Band({
      band_id: new BandId(BANDA_ID),
      name: "Trio Elétrico",
      genres: ["rock"],
      members: [
        {
          musician_id: new Uuid(SUB_LIDER_BANDA),
          role: "leader",
          instrument: "guitarra",
          status: "accepted",
          joined_at: new Date(),
          responded_at: new Date(),
        },
        {
          musician_id: new Uuid(SUB_INTEGRANTE_BANDA),
          role: "member",
          instrument: "baixo",
          status: "accepted",
          joined_at: new Date(),
          responded_at: new Date(),
        },
      ],
    }),
  );
  return repo;
}

async function seedInquiry(target: "musician" | "band") {
  const repo = new InquiryInMemoryRepository();
  const inquiry = Inquiry.create({
    establishment_id: ESTABELECIMENTO_ID,
    musician_id: target === "musician" ? SUB_MUSICO : null,
    band_id: target === "band" ? BANDA_ID : null,
    event_id: null,
    subject: "Show de sexta",
    initial_message: null,
    expires_at: null,
  });
  await repo.insert(inquiry);
  return { repo, inquiry, bandRepo: await seedBandRepo() };
}

async function seedBooking(target: "musician" | "band") {
  const repo = new BookingInMemoryRepository();
  const start = new Date(Date.now() + 86_400_000);
  const booking = Booking.create({
    establishment_id: ESTABELECIMENTO_ID,
    musician_id: target === "musician" ? SUB_MUSICO : null,
    band_id: target === "band" ? BANDA_ID : null,
    event_id: null,
    start_at: start,
    end_at: new Date(start.getTime() + 7_200_000),
    fee: 500,
    notes: null,
    buffer_minutes: 0,
    expires_at: new Date(Date.now() + 172_800_000),
  });
  await repo.insert(booking);
  return { repo, booking, bandRepo: await seedBandRepo() };
}

describe("Autorização das negociações de agenda", () => {
  describe("AcceptInquiryUseCase", () => {
    const run = async (
      seed: Awaited<ReturnType<typeof seedInquiry>>,
      ator: Ator,
      is_admin = false,
    ) =>
      new AcceptInquiryUseCase(
        seed.repo,
        undefined,
        undefined,
        seed.bandRepo,
      ).execute({
        inquiry_id: seed.inquiry.inquiry_id.id,
        requesting_participant_ids: ator.ids,
        requesting_musician_id: ator.sub,
        is_admin,
      });

    it("o músico alvo aceita a própria inquiry", async () => {
      await expect(
        run(await seedInquiry("musician"), comoMusico),
      ).resolves.toMatchObject({ status: "accepted" });
    });

    it("o líder da banda alvo aceita — via claim band_ids, não via sub", async () => {
      // O `sub` do líder sozinho não é a banda; quem identifica é o band_ids.
      await expect(
        run(await seedInquiry("band"), {
          ids: [SUB_LIDER_BANDA],
          sub: SUB_LIDER_BANDA,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      await expect(
        run(await seedInquiry("band"), comoLiderDaBanda),
      ).resolves.toMatchObject({ status: "accepted" });
    });

    // A regra que o claim sozinho não expressa: aceitar um show fecha a agenda
    // da banda inteira, então não é decisão de qualquer integrante.
    it("integrante que não é líder NÃO aceita, mesmo com o claim band_ids", async () => {
      await expect(
        run(await seedInquiry("band"), comoIntegranteDaBanda),
      ).rejects.toThrow(/Somente o líder/);
    });

    it("o estabelecimento não aceita a inquiry que ele mesmo abriu", async () => {
      await expect(
        run(await seedInquiry("musician"), comoEstabelecimento),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("terceiro que conhece o UUID não aceita", async () => {
      await expect(
        run(await seedInquiry("musician"), comoEstranho),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("admin aceita explicitamente", async () => {
      await expect(
        run(await seedInquiry("musician"), comoEstranho, true),
      ).resolves.toMatchObject({ status: "accepted" });
    });
  });

  describe("RejectInquiryUseCase", () => {
    const run = async (
      seed: Awaited<ReturnType<typeof seedInquiry>>,
      ator: Ator,
    ) =>
      new RejectInquiryUseCase(
        seed.repo,
        undefined,
        undefined,
        seed.bandRepo,
      ).execute({
        inquiry_id: seed.inquiry.inquiry_id.id,
        reason: "Agenda cheia",
        requesting_participant_ids: ator.ids,
        requesting_musician_id: ator.sub,
        is_admin: false,
      });

    it("o músico alvo rejeita", async () => {
      await expect(
        run(await seedInquiry("musician"), comoMusico),
      ).resolves.toMatchObject({ status: "rejected" });
    });

    it("o líder da banda alvo rejeita", async () => {
      await expect(
        run(await seedInquiry("band"), comoLiderDaBanda),
      ).resolves.toMatchObject({ status: "rejected" });
    });

    it("integrante que não é líder não recusa o show por todos", async () => {
      await expect(
        run(await seedInquiry("band"), comoIntegranteDaBanda),
      ).rejects.toThrow(/Somente o líder/);
    });

    it("estabelecimento e terceiro não rejeitam", async () => {
      await expect(
        run(await seedInquiry("musician"), comoEstabelecimento),
      ).rejects.toBeInstanceOf(ForbiddenException);

      await expect(
        run(await seedInquiry("musician"), comoEstranho),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("ConfirmBookingUseCase", () => {
    const run = async (
      seed: Awaited<ReturnType<typeof seedBooking>>,
      ator: Ator,
    ) =>
      new ConfirmBookingUseCase(
        seed.repo,
        dateTimeServiceStub,
        undefined,
        seed.bandRepo,
      ).execute({
        booking_id: seed.booking.booking_id.id,
        requesting_participant_ids: ator.ids,
        requesting_musician_id: ator.sub,
        is_admin: false,
      });

    // Este era o bug: `sub` nunca é igual ao UUID do estabelecimento, então
    // toda confirmação vinda de conta de estabelecimento levava 403.
    it("o estabelecimento confirma o próprio booking (regressão do 403 indevido)", async () => {
      await expect(
        run(await seedBooking("musician"), comoEstabelecimento),
      ).resolves.toMatchObject({ status: "confirmed" });
    });

    it("o músico contratado confirma", async () => {
      await expect(
        run(await seedBooking("musician"), comoMusico),
      ).resolves.toMatchObject({ status: "confirmed" });
    });

    it("o líder da banda contratada confirma", async () => {
      await expect(
        run(await seedBooking("band"), comoLiderDaBanda),
      ).resolves.toMatchObject({ status: "confirmed" });
    });

    it("integrante que não é líder não confirma pela banda", async () => {
      await expect(
        run(await seedBooking("band"), comoIntegranteDaBanda),
      ).rejects.toThrow(/Somente o líder/);
    });

    it("terceiro não confirma", async () => {
      await expect(
        run(await seedBooking("musician"), comoEstranho),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("o dono do estabelecimento sozinho, sem o claim, não confirma", async () => {
      await expect(
        run(await seedBooking("musician"), {
          ids: [SUB_DONO_ESTABELECIMENTO],
          sub: SUB_DONO_ESTABELECIMENTO,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("CancelBookingUseCase", () => {
    const run = async (
      seed: Awaited<ReturnType<typeof seedBooking>>,
      ator: Ator,
      cancelled_by: "establishment" | "musician" | "band" = "establishment",
    ) =>
      new CancelBookingUseCase(
        seed.repo,
        undefined,
        undefined,
        seed.bandRepo,
      ).execute({
        booking_id: seed.booking.booking_id.id,
        cancelled_by,
        reason: "Imprevisto",
        requesting_participant_ids: ator.ids,
        requesting_musician_id: ator.sub,
        is_admin: false,
      });

    it("o estabelecimento cancela o próprio booking (regressão do 403 indevido)", async () => {
      await expect(
        run(await seedBooking("musician"), comoEstabelecimento),
      ).resolves.toMatchObject({ status: "cancelled" });
    });

    it("o músico contratado cancela", async () => {
      await expect(
        run(await seedBooking("musician"), comoMusico, "musician"),
      ).resolves.toMatchObject({ status: "cancelled" });
    });

    it("o líder da banda contratada cancela", async () => {
      await expect(
        run(await seedBooking("band"), comoLiderDaBanda, "band"),
      ).resolves.toMatchObject({ status: "cancelled" });
    });

    it("integrante que não é líder não cancela o compromisso da banda", async () => {
      await expect(
        run(await seedBooking("band"), comoIntegranteDaBanda, "band"),
      ).rejects.toThrow(/Somente o líder/);
    });

    it("terceiro não cancela mesmo declarando cancelled_by=establishment", async () => {
      // `cancelled_by` é rótulo do motivo, não credencial — não pode autorizar.
      await expect(
        run(await seedBooking("musician"), comoEstranho),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  it("jobs internos seguem rodando sem ator (expiração/conclusão automática)", async () => {
    const { repo, booking } = await seedBooking("band");
    await expect(
      new CancelBookingUseCase(repo).execute({
        booking_id: booking.booking_id.id,
        cancelled_by: "establishment",
        reason: "Expirado pelo job",
      }),
    ).resolves.toMatchObject({ status: "cancelled" });
  });
});
