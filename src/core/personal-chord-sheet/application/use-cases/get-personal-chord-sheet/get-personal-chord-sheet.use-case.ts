import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IPersonalChordSheetRepository } from "../../../domain/personal-chord-sheet.repository";
import { loadOwnedSheet } from "../common/load-owned-sheet";
import {
  PersonalChordSheetOutput,
  PersonalChordSheetOutputMapper,
} from "../common/personal-chord-sheet-output";

export type GetPersonalChordSheetInput = {
  personal_chord_sheet_id: string;
  /**
   * De quem o fork TEM de ser — mesmo contrato de `owner_musician_id` em
   * GetPersonalChordSheetViewInput. A rota do dono passa o `musician_id` da URL;
   * a rota de comunidade passa o `access.owner_musician_id` que o
   * CheckPersonalChordSheetAccessUseCase resolveu.
   *
   * É este campo que faz a checagem de posse: o `MusicianOwnershipGuard` prova
   * que o `musician_id` da URL é o do token, mas não tem como saber de quem é o
   * fork que veio no path. Sem esta comparação, um músico lia a cifra privada de
   * outro passando o próprio id na URL e o id alheio no sub-recurso.
   */
  owner_musician_id: string;
  /**
   * Quem está lendo. `is_owner` — o flag que redige `notes` — é DERIVADO daqui
   * contra o dono real do fork, nunca afirmado pelo chamador: um controller que
   * afirmasse `is_owner: true` sem ser o dono publicaria o caderno pessoal
   * alheio, e o tipo não teria como impedir.
   */
  requesting_musician_id: string;
};

export class GetPersonalChordSheetUseCase implements IUseCase<
  GetPersonalChordSheetInput,
  PersonalChordSheetOutput
> {
  constructor(private readonly repo: IPersonalChordSheetRepository) {}

  async execute(
    input: GetPersonalChordSheetInput,
  ): Promise<PersonalChordSheetOutput> {
    // Mesmo caminho das 7 mutações do módulo: NotFoundError se não existe,
    // ForbiddenException se o fork não é de owner_musician_id.
    const sheet = await loadOwnedSheet(
      this.repo,
      input.personal_chord_sheet_id,
      input.owner_musician_id,
    );

    const isOwner = sheet.musician_id === input.requesting_musician_id;

    return PersonalChordSheetOutputMapper.toOutput(sheet, isOwner);
  }
}
