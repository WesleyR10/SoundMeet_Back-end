import { ModuleRef } from "@nestjs/core";

import { SyncBookingCancelledToGoogleCalendarUseCase } from "../../../core/google-calendar/application/use-cases/sync-booking-cancelled/sync-booking-cancelled.use-case";
import { SyncBookingConfirmedToGoogleCalendarUseCase } from "../../../core/google-calendar/application/use-cases/sync-booking-confirmed/sync-booking-confirmed.use-case";
import { Uuid } from "../../../core/shared/domain/value-objects/uuid.vo";
import { GoogleCalendarSyncConsumers } from "../google-calendar-sync.consumers";

function makeModuleRef(execute = jest.fn().mockResolvedValue({})): ModuleRef {
  return {
    resolve: jest.fn().mockResolvedValue({ execute }),
  } as unknown as ModuleRef;
}

describe("GoogleCalendarSyncConsumers", () => {
  const booking_id = new Uuid().id;

  describe("onBookingConfirmed", () => {
    it("valida a mensagem e delega pro use case resolvido via moduleRef", async () => {
      const execute = jest.fn().mockResolvedValue({});
      const moduleRef = makeModuleRef(execute);
      const consumer = new GoogleCalendarSyncConsumers(moduleRef);

      await consumer.onBookingConfirmed({ booking_id });

      expect(moduleRef.resolve).toHaveBeenCalledWith(
        SyncBookingConfirmedToGoogleCalendarUseCase,
      );
      expect(execute).toHaveBeenCalledWith({ booking_id });
    });

    it("rejeita booking_id inválido antes de tocar o use case (422 → DLX)", async () => {
      const execute = jest.fn();
      const consumer = new GoogleCalendarSyncConsumers(makeModuleRef(execute));

      await expect(
        consumer.onBookingConfirmed({ booking_id: "nao-e-uuid" }),
      ).rejects.toThrow();
      expect(execute).not.toHaveBeenCalled();
    });

    it("rejeita mensagem sem booking_id", async () => {
      const execute = jest.fn();
      const consumer = new GoogleCalendarSyncConsumers(makeModuleRef(execute));

      await expect(consumer.onBookingConfirmed({})).rejects.toThrow();
      expect(execute).not.toHaveBeenCalled();
    });
  });

  describe("onBookingCancelled", () => {
    it("valida a mensagem e delega pro use case resolvido via moduleRef", async () => {
      const execute = jest.fn().mockResolvedValue({});
      const moduleRef = makeModuleRef(execute);
      const consumer = new GoogleCalendarSyncConsumers(moduleRef);

      await consumer.onBookingCancelled({ booking_id });

      expect(moduleRef.resolve).toHaveBeenCalledWith(
        SyncBookingCancelledToGoogleCalendarUseCase,
      );
      expect(execute).toHaveBeenCalledWith({ booking_id });
    });

    it("rejeita booking_id inválido", async () => {
      const execute = jest.fn();
      const consumer = new GoogleCalendarSyncConsumers(makeModuleRef(execute));

      await expect(
        consumer.onBookingCancelled({ booking_id: "nao-e-uuid" }),
      ).rejects.toThrow();
      expect(execute).not.toHaveBeenCalled();
    });
  });
});
