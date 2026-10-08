import {
  CurrencyEnum,
  MusicianWallet as PrismaMusicianWallet,
} from "@prisma/client";

import { IEncryptionService } from "../../../../shared/domain/encryption.service";
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
  // SM-016: pixKey/bankAccount (texto puro/JSON) são legado — só lidos como
  // fallback de linhas antigas ainda não migradas pelo backfill. Escrita
  // sempre vai para as colunas cifradas abaixo.
  pixKey: string | null;
  pixKeyCiphertext: string | null;
  pixKeyIv: string | null;
  pixKeyAuthTag: string | null;
  pixKeyType: string | null;
  pixKeyChangedAt: Date | null;
  bankAccount: any | null;
  bankAccountCiphertext: string | null;
  bankAccountIv: string | null;
  bankAccountAuthTag: string | null;
  heldBalance: number;
  asaasWalletId: string | null;
  asaasApiKeyCiphertext: string | null;
  asaasApiKeyIv: string | null;
  asaasApiKeyAuthTag: string | null;
  asaasAccountStatus: string | null;
  escrowEnabled: boolean;
  mpUserId: string | null;
  mpAccessTokenCiphertext: string | null;
  mpAccessTokenIv: string | null;
  mpAccessTokenAuthTag: string | null;
  mpRefreshTokenCiphertext: string | null;
  mpRefreshTokenIv: string | null;
  mpRefreshTokenAuthTag: string | null;
  mpTokenExpiresAt: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

/** Instância (não `static`) — precisa do IEncryptionService injetado. */
export class MusicianWalletModelMapper {
  constructor(private readonly encryption: IEncryptionService) {}

  toModel(entity: MusicianWallet): MusicianWalletModelProps {
    const encryptedPixKey = entity.pix_key?.key
      ? this.encryption.encrypt(entity.pix_key.key)
      : null;
    const encryptedBankAccount = entity.bank_account
      ? this.encryption.encrypt(JSON.stringify(entity.bank_account))
      : null;
    /*
     * A apiKey da subconta move dinheiro e só existe UMA vez (o provedor não a
     * devolve depois da criação). Mesmo tratamento da chave PIX: cifrada em
     * repouso, nunca em coluna clara.
     */
    const encryptedAsaasApiKey = entity.asaas_api_key
      ? this.encryption.encrypt(entity.asaas_api_key)
      : null;
    /*
     * Tokens OAuth do Mercado Pago. O access move dinheiro na conta do músico;
     * o refresh é igualmente sensível, porque sem ele o vínculo morre em 180
     * dias. Mesmo tratamento da chave PIX e da apiKey da subconta.
     */
    const encryptedMpAccess = entity.mp_access_token
      ? this.encryption.encrypt(entity.mp_access_token)
      : null;
    const encryptedMpRefresh = entity.mp_refresh_token
      ? this.encryption.encrypt(entity.mp_refresh_token)
      : null;

    return {
      id: entity.wallet_id.id,
      musicianId: entity.musician_id.id,
      balance: entity.balance.amount,
      totalEarned: entity.total_earned.amount,
      totalWithdrawn: entity.total_withdrawn.amount,
      currency: CurrencyEnum.BRL,
      pixKey: null,
      pixKeyCiphertext: encryptedPixKey?.ciphertext ?? null,
      pixKeyIv: encryptedPixKey?.iv ?? null,
      pixKeyAuthTag: encryptedPixKey?.authTag ?? null,
      pixKeyType: entity.pix_key?.type || null,
      pixKeyChangedAt: entity.pix_key_changed_at,
      bankAccount: null,
      bankAccountCiphertext: encryptedBankAccount?.ciphertext ?? null,
      bankAccountIv: encryptedBankAccount?.iv ?? null,
      bankAccountAuthTag: encryptedBankAccount?.authTag ?? null,
      heldBalance: entity.held_balance.amount,
      asaasWalletId: entity.asaas_wallet_id,
      asaasApiKeyCiphertext: encryptedAsaasApiKey?.ciphertext ?? null,
      asaasApiKeyIv: encryptedAsaasApiKey?.iv ?? null,
      asaasApiKeyAuthTag: encryptedAsaasApiKey?.authTag ?? null,
      asaasAccountStatus: entity.asaas_account_status,
      escrowEnabled: entity.escrow_enabled,
      mpUserId: entity.mp_user_id,
      mpAccessTokenCiphertext: encryptedMpAccess?.ciphertext ?? null,
      mpAccessTokenIv: encryptedMpAccess?.iv ?? null,
      mpAccessTokenAuthTag: encryptedMpAccess?.authTag ?? null,
      mpRefreshTokenCiphertext: encryptedMpRefresh?.ciphertext ?? null,
      mpRefreshTokenIv: encryptedMpRefresh?.iv ?? null,
      mpRefreshTokenAuthTag: encryptedMpRefresh?.authTag ?? null,
      mpTokenExpiresAt: entity.mp_token_expires_at,
      is_active: entity.is_active,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  toEntity(model: PrismaMusicianWallet): MusicianWallet {
    const rawKey = this.decryptPixKey(model);
    const bankAccount = this.decryptBankAccount(model);

    return new MusicianWallet({
      wallet_id: new MusicianWalletId(model.id),
      musician_id: new Uuid(model.musicianId),
      balance: new Money(Number(model.balance)),
      total_earned: new Money(Number(model.totalEarned)),
      total_withdrawn: new Money(Number(model.totalWithdrawn)),
      pix_key:
        rawKey && PixKey.isValidType(model.pixKeyType)
          ? new PixKey(rawKey, model.pixKeyType)
          : null,
      pix_key_changed_at: model.pixKeyChangedAt ?? null,
      bank_account: bankAccount,
      held_balance: new Money(Number(model.heldBalance)),
      asaas_wallet_id: model.asaasWalletId,
      asaas_api_key: this.decryptOptional(
        model.asaasApiKeyCiphertext,
        model.asaasApiKeyIv,
        model.asaasApiKeyAuthTag,
      ),
      asaas_account_status: model.asaasAccountStatus,
      escrow_enabled: model.escrowEnabled,
      mp_user_id: model.mpUserId,
      mp_access_token: this.decryptOptional(
        model.mpAccessTokenCiphertext,
        model.mpAccessTokenIv,
        model.mpAccessTokenAuthTag,
      ),
      mp_refresh_token: this.decryptOptional(
        model.mpRefreshTokenCiphertext,
        model.mpRefreshTokenIv,
        model.mpRefreshTokenAuthTag,
      ),
      mp_token_expires_at: model.mpTokenExpiresAt,
      is_active: model.is_active,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }

  private decryptPixKey(model: PrismaMusicianWallet): string | null {
    if (model.pixKeyCiphertext && model.pixKeyIv && model.pixKeyAuthTag) {
      return this.encryption.decrypt({
        ciphertext: model.pixKeyCiphertext,
        iv: model.pixKeyIv,
        authTag: model.pixKeyAuthTag,
      });
    }
    return model.pixKey ?? null;
  }

  /**
   * Decifra um trio ciphertext/iv/authTag, ou `null` se incompleto.
   *
   * Sem fallback para coluna clara: estes campos **nasceram** cifrados,
   * diferente de `pixKey`/`bankAccount`, que têm coluna legada de antes do
   * SM-016.
   */
  private decryptOptional(
    ciphertext: string | null,
    iv: string | null,
    authTag: string | null,
  ): string | null {
    if (!ciphertext || !iv || !authTag) return null;
    return this.encryption.decrypt({ ciphertext, iv, authTag });
  }

  private decryptBankAccount(model: PrismaMusicianWallet): any | null {
    if (
      model.bankAccountCiphertext &&
      model.bankAccountIv &&
      model.bankAccountAuthTag
    ) {
      const json = this.encryption.decrypt({
        ciphertext: model.bankAccountCiphertext,
        iv: model.bankAccountIv,
        authTag: model.bankAccountAuthTag,
      });
      return JSON.parse(json);
    }
    return model.bankAccount ?? null;
  }
}
