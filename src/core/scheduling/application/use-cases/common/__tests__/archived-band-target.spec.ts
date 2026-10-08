import { bandLedBy } from "../../../../../musician/application/use-cases/common/__tests__/band-fixtures";
import { Band } from "../../../../../musician/domain/band.aggregate";
import { BandInMemoryRepository } from "../../../../../musician/infra/db/in-memory/band-in-memory.repository";
import { InvalidOperationError } from "../../../../../shared/domain/errors/invalid-operation.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { BookingInMemoryRepository } from "../../../../infra/db/in-memory/booking-in-memory.repository";
import { InquiryInMemoryRepository } from "../../../../infra/db/in-memory/inquiry-in-memory.repository";
import { CreateInquiryInput } from "../../create-inquiry/create-inquiry.input";
import { CreateInquiryUseCase } from "../../create-inquiry/create-inquiry.use-case";
import { ProposeBookingInput } from "../../propose-booking/propose-booking.input";
import { ProposeBookingUseCase } from "../../propose-booking/propose-booking.use-case";

/**
 * 🔴 Banda dissolvida com histórico continua EXISTINDO (arquivada) — é o que
 * mantém o nome dela nos shows antigos. Por isso as duas portas por onde uma
 * negociação nasce precisam recusá-la: sem isto, quem guardou o id seguiria
 * propondo show a uma banda que não toca mais, e ninguém do outro lado
 * conseguiria responder.
 */

const ESTABELECIMENTO_ID = "33333333-3333-4333-8333-333333333333";
const SUB_DONO = "22222222-2222-4222-8222-222222222222";

const dateTimeServiceStub = {
  addHours: (date: Date, hours: number) =>
    new Date(date.getTime() + hours * 3600_000),
} as never;

describe("negociação com banda arquivada", () => {
  let bandRepo: BandInMemoryRepository;
  let active: Band;
  let archived: Band;

  beforeEach(async () => {
    bandRepo = new BandInMemoryRepository();
    active = bandLedBy(new Uuid());
    archived = bandLedBy(new Uuid());
    archived.archive();
    await bandRepo.bulkInsert([active, archived]);
  });

  describe("ProposeBookingUseCase", () => {
    const propose = (band_id: string) => {
      const bookingRepo = new BookingInMemoryRepository();
      const useCase = new ProposeBookingUseCase(
        bookingRepo,
        dateTimeServiceStub,
        undefined,
        bandRepo,
      );
      return {
        bookingRepo,
        result: useCase.execute(
          new ProposeBookingInput({
            establishment_id: ESTABELECIMENTO_ID,
            band_id,
            start_at: new Date("2027-03-10T22:00:00.000Z"),
            end_at: new Date("2027-03-11T02:00:00.000Z"),
            fee: 1500,
            requesting_participant_ids: [SUB_DONO, ESTABELECIMENTO_ID],
            requesting_musician_id: SUB_DONO,
          }),
        ),
      };
    };

    it("recusa proposta para banda arquivada e não grava nada", async () => {
      const { bookingRepo, result } = propose(archived.band_id.id);

      await expect(result).rejects.toThrow(InvalidOperationError);
      expect(bookingRepo.items).toHaveLength(0);
    });

    it("banda ativa continua recebendo proposta", async () => {
      const { bookingRepo, result } = propose(active.band_id.id);

      await expect(result).resolves.toMatchObject({
        band_id: active.band_id.id,
      });
      expect(bookingRepo.items).toHaveLength(1);
    });
  });

  describe("CreateInquiryUseCase", () => {
    const inquire = (band_id: string) => {
      const inquiryRepo = new InquiryInMemoryRepository();
      const useCase = new CreateInquiryUseCase(
        inquiryRepo,
        undefined,
        bandRepo,
      );
      return {
        inquiryRepo,
        result: useCase.execute(
          new CreateInquiryInput({
            establishment_id: ESTABELECIMENTO_ID,
            band_id,
            subject: "Sexta que vem",
            requesting_participant_ids: [SUB_DONO, ESTABELECIMENTO_ID],
            requesting_musician_id: SUB_DONO,
          }),
        ),
      };
    };

    it("recusa conversa com banda arquivada e não grava nada", async () => {
      const { inquiryRepo, result } = inquire(archived.band_id.id);

      await expect(result).rejects.toThrow(InvalidOperationError);
      expect(inquiryRepo.items).toHaveLength(0);
    });

    it("banda ativa continua recebendo conversa", async () => {
      const { inquiryRepo, result } = inquire(active.band_id.id);

      await expect(result).resolves.toMatchObject({
        band_id: active.band_id.id,
      });
      expect(inquiryRepo.items).toHaveLength(1);
    });
  });
});
