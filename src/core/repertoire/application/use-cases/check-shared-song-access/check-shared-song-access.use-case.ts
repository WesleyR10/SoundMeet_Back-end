import { IUseCase } from "../../../../shared/application/use-case.interface";
import { InvalidOperationError } from "../../../../shared/domain/errors/invalid-operation.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Repertoire } from "../../../domain/repertoire.aggregate";
import { IRepertoireRepository } from "../../../domain/repertoire.repository";

export type CheckSharedSongAccessInput = {
  share_token: string;
  music_library_id: string;
};

export type CheckSharedSongAccessOutput = {
  owner_musician_id: string;
};

// Equivalente público (sem musician_id, sem JWT) de
// CheckRepertoireSongAccessUseCase — usado pelo link de compartilhamento
// público (fã ou qualquer músico sem vínculo vendo a cifra de um repertório
// compartilhado). Token substitui a identidade do chamador: mesma regra do
// GetSharedRepertoireUseCase (isShareTokenValid — expira em 7 dias).
export class CheckSharedSongAccessUseCase implements IUseCase<
  CheckSharedSongAccessInput,
  CheckSharedSongAccessOutput
> {
  constructor(private readonly repertoireRepo: IRepertoireRepository) {}

  async execute(
    input: CheckSharedSongAccessInput,
  ): Promise<CheckSharedSongAccessOutput> {
    const repertoire = await this.repertoireRepo.findByShareToken(
      input.share_token,
    );
    if (!repertoire) {
      throw new NotFoundError(input.share_token, Repertoire);
    }

    if (!repertoire.isShareTokenValid()) {
      throw new InvalidOperationError(
        "O link de compartilhamento expirou ou foi desativado.",
      );
    }

    const hasSong = repertoire.songs.some(
      (s) => s.music_library_id === input.music_library_id,
    );
    if (!hasSong) {
      throw new NotFoundError(input.music_library_id, Repertoire);
    }

    return { owner_musician_id: repertoire.musician_id };
  }
}
