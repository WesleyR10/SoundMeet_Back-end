import {
  IMusicianWalletRepository,
  MusicianWallet,
  MusicianWalletOutput,
  MusicianWalletOutputMapper,
} from "@core/payment";
import { IUseCase } from "@core/shared/application/use-case.interface";
import { NotFoundError } from "@core/shared/domain/errors";

export type GetMusicianWalletInput = {
  musician_id: string;
};

export type GetMusicianWalletOutput = MusicianWalletOutput;

export class GetMusicianWalletUseCase implements IUseCase<
  GetMusicianWalletInput,
  GetMusicianWalletOutput
> {
  constructor(private readonly walletRepository: IMusicianWalletRepository) {}

  async execute(
    input: GetMusicianWalletInput,
  ): Promise<GetMusicianWalletOutput> {
    const wallet = await this.walletRepository.findByMusicianId(
      input.musician_id,
    );

    if (!wallet) {
      throw new NotFoundError(input.musician_id, MusicianWallet);
    }

    return MusicianWalletOutputMapper.toOutput(wallet);
  }
}
