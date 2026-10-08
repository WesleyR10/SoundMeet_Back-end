import { ForbiddenException } from "@nestjs/common";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  PersonalChordSheet,
  PersonalChordSheetId,
} from "../../../domain/personal-chord-sheet.aggregate";
import { IPersonalChordSheetRepository } from "../../../domain/personal-chord-sheet.repository";

export type CheckPersonalChordSheetAccessInput = {
  personal_chord_sheet_id: string;
  /** undefined = admin (moderação) — vê qualquer fork. */
  requesting_musician_id?: string;
  /** Bandas do requisitante, para resolver o escopo "band". */
  requesting_musician_band_peers?: string[];
};

export type CheckPersonalChordSheetAccessOutput = {
  owner_musician_id: string;
  music_library_id: string;
  is_owner: boolean;
};

/**
 * Autoriza a leitura de um fork por quem não é necessariamente o dono.
 *
 * Fica fora do guard de propósito — mesmo racional do
 * CheckRepertoireSongAccessUseCase: o MusicianOwnershipGuard compara o id da
 * URL com o do token, e aqui o requisitante legitimamente NÃO é o dono. Quem
 * decide é a regra de escopo do agregado.
 */
export class CheckPersonalChordSheetAccessUseCase implements IUseCase<
  CheckPersonalChordSheetAccessInput,
  CheckPersonalChordSheetAccessOutput
> {
  constructor(private readonly repo: IPersonalChordSheetRepository) {}

  async execute(
    input: CheckPersonalChordSheetAccessInput,
  ): Promise<CheckPersonalChordSheetAccessOutput> {
    const sheet = await this.repo.findById(
      new PersonalChordSheetId(input.personal_chord_sheet_id),
    );
    if (!sheet) {
      throw new NotFoundError(
        input.personal_chord_sheet_id,
        PersonalChordSheet,
      );
    }

    const isAdmin = input.requesting_musician_id === undefined;
    const isOwner = sheet.musician_id === input.requesting_musician_id;

    if (isAdmin || isOwner) {
      return {
        owner_musician_id: sheet.musician_id,
        music_library_id: sheet.music_library_id,
        is_owner: isOwner,
      };
    }

    const allowed =
      sheet.share_scope === "community" ||
      (sheet.share_scope === "band" &&
        (input.requesting_musician_band_peers ?? []).includes(
          sheet.musician_id,
        ));

    if (!allowed) {
      // Mensagem igual para "privado" e "não é da sua banda": não confirmamos
      // a existência de um fork privado para quem não deveria saber dele.
      throw new ForbiddenException("Você não tem acesso a esta cifra pessoal.");
    }

    return {
      owner_musician_id: sheet.musician_id,
      music_library_id: sheet.music_library_id,
      is_owner: false,
    };
  }
}
