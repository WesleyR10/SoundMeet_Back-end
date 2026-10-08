import { ForbiddenException } from "@nestjs/common";

import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  PersonalChordSheet,
  PersonalChordSheetId,
} from "../../../domain/personal-chord-sheet.aggregate";
import { IPersonalChordSheetRepository } from "../../../domain/personal-chord-sheet.repository";

/**
 * Carrega um fork exigindo que quem pede seja o dono (ou admin).
 *
 * Toda mutação passa por aqui: o MusicianOwnershipGuard confere o musician_id
 * da URL contra o token, mas não sabe de quem é o fork que veio no path — sem
 * esta checagem, um músico editaria a cifra pessoal de outro.
 */
export async function loadOwnedSheet(
  repo: IPersonalChordSheetRepository,
  personal_chord_sheet_id: string,
  /** undefined = admin (moderação). */
  requesting_musician_id?: string,
): Promise<PersonalChordSheet> {
  const sheet = await repo.findById(
    new PersonalChordSheetId(personal_chord_sheet_id),
  );
  if (!sheet) {
    throw new NotFoundError(personal_chord_sheet_id, PersonalChordSheet);
  }

  const isAdmin = requesting_musician_id === undefined;
  if (!isAdmin && sheet.musician_id !== requesting_musician_id) {
    throw new ForbiddenException("Esta cifra pessoal não é sua.");
  }

  return sheet;
}
