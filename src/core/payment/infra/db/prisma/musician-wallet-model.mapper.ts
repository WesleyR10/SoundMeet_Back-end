import {
  CurrencyEnum,
  MusicianWallet as PrismaMusicianWallet,
} from "@prisma/client";

import { Money } from "../../../../shared/domain/value-objects/money.vo";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import {
  MusicianWallet,
  MusicianWalletId,
} from "../../../domain/musician-wallet.aggregate";
import { PixKey } from "../../../domain/value-objects/pix-key.vo";

export type MusicianWalletModelProps = {
  id: string;
  musicianId: string;
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  currency: CurrencyEnum;
  pixKey: string | null;
  pixKeyType: string | null;
  bankAccount: any | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export class MusicianWalletModelMapper {
  static toModel(entity: MusicianWallet): MusicianWalletModelProps {
    return {
      id: entity.wallet_id.id,
      musicianId: entity.musician_id.id,
      balance: entity.balance.amount,
      totalEarned: entity.total_earned.amount,
      totalWithdrawn: entity.total_withdrawn.amount,
      currency: CurrencyEnum.BRL,
      pixKey: entity.pix_key?.key || null,
      pixKeyType: entity.pix_key?.type || null,
      bankAccount: entity.bank_account,
      is_active: entity.is_active,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: PrismaMusicianWallet): MusicianWallet {
    return new MusicianWallet({
      wallet_id: new MusicianWalletId(model.id),
      musician_id: new Uuid(model.musicianId),
      balance: new Money(Number(model.balance)),
      total_earned: new Money(Number(model.totalEarned)),
      total_withdrawn: new Money(Number(model.totalWithdrawn)),
      pix_key: model.pixKey
        ? new PixKey(model.pixKey, (model.pixKeyType as any) || "unknown")
        : null,
      bank_account: model.bankAccount,
      is_active: model.is_active,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }
}
