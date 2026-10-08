import {
  BookingEscrow as PrismaBookingEscrow,
  BookingEscrowStatus as PrismaBookingEscrowStatus,
  CurrencyEnum,
} from "@prisma/client";

import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { Money } from "../../../../shared/domain/value-objects/money.vo";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import {
  BookingEscrow,
  BookingEscrowId,
} from "../../../domain/booking-escrow.aggregate";
import { BookingEscrowStatus } from "../../../domain/booking-escrow-enums";

export class BookingEscrowModelMapper {
  static toModel(entity: BookingEscrow) {
    return {
      id: entity.escrow_id.id,
      bookingId: entity.booking_id.id,
      musicianId: entity.musician_id?.id ?? null,
      amount: entity.amount.amount,
      platformFee: entity.platform_fee.amount,
      netAmount: entity.net_amount.amount,
      currency: CurrencyEnum.BRL,
      status: entity.status as unknown as PrismaBookingEscrowStatus,
      externalId: entity.external_id,
      expiresAt: entity.expires_at,
      heldAt: entity.held_at,
      releasedAt: entity.released_at,
      refundedAt: entity.refunded_at,
      resolutionNote: entity.resolution_note,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  /**
   * ⚠️ `amount`/`platformFee`/`netAmount` são `Decimal` no Prisma e `number` no
   * domínio — o `Number()` explícito não é decoração.
   *
   * Foi exatamente o buraco do 9.7b (`EventMusician.fee`): o repositório passava
   * `as any`, o compilador nunca via, e o `Decimal` chegava ao agregado até o
   * `@IsNumber()` recusar e transformar UMA linha com valor gravado num 422
   * permanente para a listagem inteira.
   */
  static toEntity(model: PrismaBookingEscrow): BookingEscrow {
    const escrow = new BookingEscrow({
      escrow_id: new BookingEscrowId(model.id),
      booking_id: new Uuid(model.bookingId),
      musician_id: model.musicianId ? new Uuid(model.musicianId) : null,
      amount: new Money(Number(model.amount)),
      platform_fee: new Money(Number(model.platformFee)),
      net_amount: new Money(Number(model.netAmount)),
      status: model.status as unknown as BookingEscrowStatus,
      external_id: model.externalId,
      expires_at: model.expiresAt,
      held_at: model.heldAt,
      released_at: model.releasedAt,
      refunded_at: model.refundedAt,
      resolution_note: model.resolutionNote,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });

    escrow.validate();
    if (escrow.notification.hasErrors()) {
      throw new LoadEntityError(escrow.notification.toJSON());
    }

    return escrow;
  }
}
