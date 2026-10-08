import {
  CurrencyEnum,
  Tip as PrismaTip,
  TipStatus as PrismaTipStatus,
} from "@prisma/client";

import { IEncryptionService } from "../../../../shared/domain/encryption.service";
import { Money } from "../../../../shared/domain/value-objects/money.vo";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Tip } from "../../../domain/tip.aggregate";
import { PaymentMethod, TipStatus } from "../../../domain/tip-enums";
import { PixKey } from "../../../domain/value-objects/pix-key.vo";

export type TipModelProps = {
  id: string;
  audienceId: string;
  musicianId: string | null;
  bandId: string | null;
  eventId: string | null;
  amount: number;
  currency: CurrencyEnum;
  message: string | null;
  paymentMethod: string;
  status: PrismaTipStatus;
  transactionId: string | null;
  // SM-016: pixKey (texto puro) é legado — o mapper nunca mais escreve nele,
  // só lê como fallback de leitura em linhas antigas ainda não migradas pelo
  // backfill. Escrita sempre vai para as 3 colunas cifradas abaixo.
  pixKey: string | null;
  pixKeyCiphertext: string | null;
  pixKeyIv: string | null;
  pixKeyAuthTag: string | null;
  pixKeyType: string | null;
  pixQrCode: string | null;
  pixCopyPaste: string | null;
  isAnonymous: boolean;
  showInWall: boolean;
  created_at: Date;
  updated_at: Date;
};

/**
 * Instância (não mais `static`) porque precisa do IEncryptionService injetado
 * — cifra em toModel, decifra em toEntity (com fallback pro texto puro
 * legado enquanto o backfill não roda). Ver mesmo padrão em
 * GoogleCalendarIntegrationModelMapper, só que lá o agregado já guarda o
 * EncryptedPayload; aqui o domínio (Tip.pix_key) continua com o PixKey VO em
 * claro — a cifra é só uma preocupação de infra, na borda do mapper.
 */
export class TipModelMapper {
  constructor(private readonly encryption: IEncryptionService) {}

  toModel(entity: Tip): TipModelProps {
    const encryptedPixKey = entity.pix_key?.key
      ? this.encryption.encrypt(entity.pix_key.key)
      : null;

    return {
      id: entity.tip_id.id,
      audienceId: entity.audience_id.id,
      musicianId: entity.musician_id?.id ?? null,
      bandId: entity.band_id?.id ?? null,
      eventId: entity.event_id?.id || null,
      amount: entity.amount.amount,
      currency: CurrencyEnum.BRL,
      message: entity.message,
      paymentMethod: entity.payment_method,
      status: entity.status as PrismaTipStatus,
      transactionId: entity.transaction_id,
      pixKey: null,
      pixKeyCiphertext: encryptedPixKey?.ciphertext ?? null,
      pixKeyIv: encryptedPixKey?.iv ?? null,
      pixKeyAuthTag: encryptedPixKey?.authTag ?? null,
      pixKeyType: entity.pix_key?.type || null,
      isAnonymous: entity.is_anonymous,
      showInWall: entity.show_in_wall,
      pixQrCode: entity.pix_qr_code,
      pixCopyPaste: entity.pix_copy_paste,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  toEntity(model: PrismaTip): Tip {
    const rawKey = this.decryptPixKey(model);
    const pixKey =
      rawKey && PixKey.isValidType(model.pixKeyType)
        ? new PixKey(rawKey, model.pixKeyType)
        : null;

    return new Tip({
      tip_id: new Uuid(model.id),
      audience_id: new Uuid(model.audienceId),
      musician_id: model.musicianId ? new Uuid(model.musicianId) : null,
      band_id: model.bandId ? new Uuid(model.bandId) : null,
      event_id: model.eventId ? new Uuid(model.eventId) : null,
      amount: new Money(Number(model.amount)),
      message: model.message,
      payment_method: model.paymentMethod as PaymentMethod,
      status: model.status as TipStatus,
      transaction_id: model.transactionId,
      pix_key: pixKey,
      is_anonymous: model.isAnonymous,
      show_in_wall: model.showInWall,
      pix_qr_code: model.pixQrCode,
      pix_copy_paste: model.pixCopyPaste,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }

  private decryptPixKey(model: PrismaTip): string | null {
    if (model.pixKeyCiphertext && model.pixKeyIv && model.pixKeyAuthTag) {
      return this.encryption.decrypt({
        ciphertext: model.pixKeyCiphertext,
        iv: model.pixKeyIv,
        authTag: model.pixKeyAuthTag,
      });
    }
    return model.pixKey ?? null;
  }
}
