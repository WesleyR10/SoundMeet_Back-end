import { IMusicianWalletRepository, MusicianWallet } from "@core/payment";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { MusicianWalletOutput, MusicianWalletOutputMapper } from "../common/musician-wallet-output";

export type UpdateMusicianPixKeyInput = {
  musician_id: string;
  pix_key: string;
  pix_key_type: string;
};

export type UpdateMusicianPixKeyOutput = MusicianWalletOutput;

export class UpdateMusicianPixKeyUseCase
  implements IUseCase<UpdateMusicianPixKeyInput, UpdateMusicianPixKeyOutput>
{
  constructor(private readonly walletRepository: IMusicianWalletRepository) {}

  async execute(input: UpdateMusicianPixKeyInput): Promise<UpdateMusicianPixKeyOutput> {
    let wallet = await this.walletRepository.findByMusicianId(input.musician_id);

    if (!wallet) {
      // If wallet doesn't exist, create it (lazy creation pattern)
      wallet = MusicianWallet.create({ musician_id: input.musician_id });
      await this.walletRepository.insert(wallet);
    }

    wallet.updatePixKey(input.pix_key, input.pix_key_type);
    await this.walletRepository.update(wallet);

    return MusicianWalletOutputMapper.toOutput(wallet);
  }
}
