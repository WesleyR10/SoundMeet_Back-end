import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import { IMusicianStorage } from "../../ports/musician-storage.interface";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../common/musician-profile-output";

export type DeleteMusicianPresentationAudioInput = {
  musician_id: string;
};

export type DeleteMusicianPresentationAudioOutput = MusicianOutput;

/**
 * Remove o áudio de apresentação.
 *
 * **Idempotente de propósito:** quem não tem áudio recebe 200 com
 * `presentation_audio: null`, não um erro. O único jeito de chegar aqui é
 * apertar "remover", e quem já não tem áudio quer exatamente o estado que já
 * tem — falhar ali só produziria um alerta vermelho sem nada a corrigir.
 */
export class DeleteMusicianPresentationAudioUseCase implements IUseCase<
  DeleteMusicianPresentationAudioInput,
  DeleteMusicianPresentationAudioOutput
> {
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    private readonly storage: IMusicianStorage,
  ) {}

  async execute(
    input: DeleteMusicianPresentationAudioInput,
  ): Promise<DeleteMusicianPresentationAudioOutput> {
    const musicianId = new MusicianId(input.musician_id);
    const musician = await this.musicianRepo.findById(musicianId);

    if (!musician) {
      throw new NotFoundError(input.musician_id, Musician);
    }

    const previousKey = musician.removePresentationAudio();

    // Banco primeiro, bucket depois: apagar o objeto antes deixaria a grade
    // servindo uma URL morta se o update falhasse. A limpeza do bucket é
    // best-effort — um objeto órfão custa centavos, uma resposta 500 custa a
    // confiança de quem só queria tirar o áudio do ar.
    await this.musicianRepo.update(musician);

    if (previousKey) {
      await this.storage
        .deleteObject({ object_key: previousKey })
        .catch(() => undefined);
    }

    return MusicianOutputMapper.toOutput(musician);
  }
}
