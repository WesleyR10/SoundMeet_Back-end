import { MusicianWallet } from "../../../domain/musician-wallet.entity";

export type MusicianWalletOutput = {
  id: string;
  musician_id: string;
  balance: number;
  total_earned: number;
  total_withdrawn: number;
  pix_key: string | null;
  bank_account: any | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export class MusicianWalletOutputMapper {
  static toOutput(entity: MusicianWallet): MusicianWalletOutput {
    const { wallet_id, ...otherProps } = entity.toJSON();
    return {
      id: wallet_id,
      ...otherProps,
    } as MusicianWalletOutput;
  }
}
