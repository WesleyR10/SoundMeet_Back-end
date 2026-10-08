import { PrismaClient } from "@prisma/client";

import { BookingSearchParams } from "../../../../domain/booking.repository";
import { InquirySearchParams } from "../../../../domain/inquiry.repository";
import { BookingPrismaRepository } from "../booking-prisma.repository";
import { InquiryPrismaRepository } from "../inquiry-prisma.repository";

const IDS = [
  "11111111-1111-4111-8111-111111111111",
  "55555555-5555-4555-8555-555555555555",
];

/**
 * O `where` do Prisma não é exercitado por nenhum teste de use-case — aqueles
 * rodam contra o repositório in-memory. Foi exatamente assim que o bug de
 * `ConversationPrismaRepository.findByParticipant` (que omitia
 * `establishment_id` no OR e escondia as conversas do estabelecimento em
 * produção) passou despercebido: o in-memory tinha os três campos, o Prisma
 * não. Este spec cobre a mesma classe de erro no escopo de agenda.
 */
describe("Escopo por participante no Prisma (Bloco 9.2)", () => {
  function makePrisma() {
    return {
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      inquiry: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    } as unknown as PrismaClient;
  }

  describe("BookingPrismaRepository", () => {
    it("gera OR nos TRÊS lados possíveis", async () => {
      const prisma = makePrisma();
      const repo = new BookingPrismaRepository(prisma);

      await repo.search(
        BookingSearchParams.create({ filter: { participant_ids: IDS } }),
      );

      const { where } = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
      expect(where.OR).toEqual([
        { establishmentId: { in: IDS } },
        { musicianId: { in: IDS } },
        { bandId: { in: IDS } },
      ]);
    });

    it("aplica o mesmo where na contagem — senão o total mente sobre o escopo", async () => {
      const prisma = makePrisma();
      const repo = new BookingPrismaRepository(prisma);

      await repo.search(
        BookingSearchParams.create({ filter: { participant_ids: IDS } }),
      );

      const findWhere = (prisma.booking.findMany as jest.Mock).mock.calls[0][0]
        .where;
      const countWhere = (prisma.booking.count as jest.Mock).mock.calls[0][0]
        .where;
      expect(countWhere).toEqual(findWhere);
    });

    it("combina escopo (OR) com filtro comum (AND), sem sobrescrever", async () => {
      const prisma = makePrisma();
      const repo = new BookingPrismaRepository(prisma);

      await repo.search(
        BookingSearchParams.create({
          filter: { participant_ids: IDS, status: "confirmed" },
        }),
      );

      const { where } = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
      expect(where.status).toBe("confirmed");
      expect(where.OR).toHaveLength(3);
    });

    // O caso que vira vazamento se tratado como "sem filtro".
    it("lista vazia de identidades vira condição impossível, não ausência de filtro", async () => {
      const prisma = makePrisma();
      const repo = new BookingPrismaRepository(prisma);

      await repo.search(
        BookingSearchParams.create({ filter: { participant_ids: [] } }),
      );

      const { where } = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
      expect(where.OR).toBeUndefined();
      expect(where.id).toEqual({ in: [] });
    });

    it("sem participant_ids não injeta escopo algum", async () => {
      const prisma = makePrisma();
      const repo = new BookingPrismaRepository(prisma);

      await repo.search(
        BookingSearchParams.create({ filter: { status: "confirmed" } }),
      );

      const { where } = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
      expect(where.OR).toBeUndefined();
      expect(where.id).toBeUndefined();
    });
  });

  describe("InquiryPrismaRepository", () => {
    it("gera OR nos TRÊS lados possíveis", async () => {
      const prisma = makePrisma();
      const repo = new InquiryPrismaRepository(prisma);

      await repo.search(
        InquirySearchParams.create({ filter: { participant_ids: IDS } }),
      );

      const { where } = (prisma.inquiry.findMany as jest.Mock).mock.calls[0][0];
      expect(where.OR).toEqual([
        { establishmentId: { in: IDS } },
        { musicianId: { in: IDS } },
        { bandId: { in: IDS } },
      ]);
    });

    it("lista vazia vira condição impossível", async () => {
      const prisma = makePrisma();
      const repo = new InquiryPrismaRepository(prisma);

      await repo.search(
        InquirySearchParams.create({ filter: { participant_ids: [] } }),
      );

      const { where } = (prisma.inquiry.findMany as jest.Mock).mock.calls[0][0];
      expect(where.id).toEqual({ in: [] });
    });
  });
});
