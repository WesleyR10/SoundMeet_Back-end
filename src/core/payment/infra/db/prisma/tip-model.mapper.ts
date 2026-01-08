import { Tip as PrismaTip } from "@prisma/client";

import { Money } from "../../../../shared/domain/value-objects/money.vo";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Tip } from "../../../domain/tip.entity";
import { PaymentMethod, TipStatus } from "../../../domain/tip-enums";
import { PixKey } from "../../../domain/value-objects/pix-key.vo";

export type TipModelProps = {
  id: string;
  audienceId: string;
  musicianId: string | null;
  bandId: string | null;
  eventId: string | null;
  amount: number;
  message: string | null;
  paymentMethod: string;
  status: string;
  transactionId: string | null;
  pixKey: string | null;
  pixKeyType: string | null;
  isAnonymous: boolean;
  showInWall: boolean;
  created_at: Date;
  updated_at: Date;
};

export class TipModelMapper {
  static toModel(entity: Tip): TipModelProps {
    const model = {
      id: entity.tip_id.id,
      audienceId: entity.audience_id.id,
      musicianId: entity.musician_id?.id ?? null,
      bandId: entity.band_id?.id ?? null,
      eventId: entity.event_id?.id || null,
      amount: entity.amount.amount,
      message: entity.message,
      paymentMethod: entity.payment_method,
      status: entity.status,
      transactionId: entity.transaction_id,
      pixKey: entity.pix_key?.key || null,
      pixKeyType: entity.pix_key?.type || null,
      isAnonymous: entity.is_anonymous,
      showInWall: entity.show_in_wall,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };

    // Remove propriedades nulas para evitar conflitos de tipagem
    // No caso do musicianId e outros relacionamentos opcionais, o Prisma espera que sejam undefined se não existirem na criação
    // ou que a tipagem do mapper corresponda exatamente aos tipos gerados
    // No caso específico do erro relatado, o Prisma pode estar esperando um tipo específico

    // Uma abordagem mais segura é retornar exatamente o que o Prisma espera
    // Se musicianId for null, passamos null explicitamente, mas garantimos que a tipagem esteja correta
    return model;
  }

  static toEntity(model: PrismaTip): Tip {
    const pixKey = model.pixKey
      ? new PixKey(model.pixKey, (model.pixKeyType as any) || "unknown")
      : null;

    return new Tip({
      tip_id: new Uuid(model.id),
      audience_id: new Uuid(model.audienceId),
      musician_id: model.musicianId ? new Uuid(model.musicianId) : null,
      band_id: model.bandId ? new Uuid(model.bandId) : null,
      event_id: model.eventId ? new Uuid(model.eventId) : null,
      amount: new Money(model.amount),
      message: model.message,
      payment_method: model.paymentMethod as PaymentMethod,
      status: model.status as TipStatus,
      transaction_id: model.transactionId,
      pix_key: pixKey,
      is_anonymous: model.isAnonymous,
      show_in_wall: model.showInWall,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }
}
