import { ForbiddenException } from "@nestjs/common";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Repertoire, RepertoireId } from "../../../domain/repertoire.aggregate";
import { IRepertoireRepository } from "../../../domain/repertoire.repository";

export type CheckRepertoireSongAccessInput = {
  repertoire_id: string;
  requesting_musician_id: string;
  music_library_id: string;
};

export type CheckRepertoireSongAccessOutput = {
  owner_musician_id: string;
};

// Autoriza acesso a uma música ATRAVÉS de um repertório — dono sempre pode;
// convidado nominal (RepertoireInvitee) só pode se a música realmente estiver
// no repertório. Existe pra resolver o gap descoberto no Bloco 7: um músico
// convidado conseguia ver a lista de músicas do repertório (GET .../:id já
// permitia isOwner=false), mas não conseguia abrir a cifra de nenhuma delas —
// GET /music-library/:id/chord-sheet exige musician_id = dono, sem noção de
// convite. Este use-case fica no domínio `repertoire` (não em
// `synced-lyrics`, que fica intocado) porque "quem pode acessar o quê
// através de um repertório" é uma pergunta natural desse domínio — mesmo
// precedente de GetRepertoireUseCase já depender de MusicLibrary.
export class CheckRepertoireSongAccessUseCase implements IUseCase<
  CheckRepertoireSongAccessInput,
  CheckRepertoireSongAccessOutput
> {
  constructor(private readonly repertoireRepo: IRepertoireRepository) {}

  async execute(
    input: CheckRepertoireSongAccessInput,
  ): Promise<CheckRepertoireSongAccessOutput> {
    const repertoire = await this.repertoireRepo.findById(
      new RepertoireId(input.repertoire_id),
    );
    if (!repertoire) {
      throw new NotFoundError(input.repertoire_id, Repertoire);
    }

    const isOwner = repertoire.musician_id === input.requesting_musician_id;
    const isInvitee = repertoire.invitees.some(
      (i) => i.musician_id === input.requesting_musician_id,
    );
    if (!isOwner && !isInvitee) {
      throw new ForbiddenException(
        "Você não tem acesso a este repertório.",
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
