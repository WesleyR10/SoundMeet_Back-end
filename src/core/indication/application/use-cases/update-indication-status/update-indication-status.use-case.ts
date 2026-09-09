import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors";
import { Indication, IndicationId } from "../../../domain/indication.aggregate";
import { IIndicationRepository } from "../../../domain/indication.repository";
import { IndicationStatus } from "../../../domain/indication-types";
import {
  IndicationOutput,
  IndicationOutputMapper,
} from "../common/indication-output";

export type UpdateIndicationStatusInput = {
  indication_id: string;
  /** Escopo do dono — vem do path + guard, nunca do corpo. */
  establishment_id: string;
  status: Extract<IndicationStatus, "seen" | "archived">;
};

/**
 * O estabelecimento marca a indicação como vista ou a arquiva.
 *
 * 🔴 `establishment_id` é conferido contra a linha carregada. Sem isso, o
 * `:indication_id` do path bastaria para qualquer estabelecimento arquivar as
 * indicações de outro — o guard prova quem é o usuário, nunca de quem é o
 * sub-recurso (mesma armadilha registrada em `personal-chord-sheet`).
 *
 * Responde **404, não 403**, quando a indicação é de outra casa: dizer "existe
 * mas não é sua" já confirma a existência a quem não deveria saber.
 */
export class UpdateIndicationStatusUseCase implements IUseCase<
  UpdateIndicationStatusInput,
  IndicationOutput
> {
  constructor(private readonly indicationRepo: IIndicationRepository) {}

  async execute(input: UpdateIndicationStatusInput): Promise<IndicationOutput> {
    const indication = await this.indicationRepo.findById(
      new IndicationId(input.indication_id),
    );

    if (!indication || indication.establishment_id !== input.establishment_id) {
      throw new NotFoundError(input.indication_id, Indication);
    }

    if (input.status === "archived") {
      indication.archive();
    } else {
      indication.markAsSeen();
    }

    await this.indicationRepo.update(indication);

    return IndicationOutputMapper.toOutput(indication);
  }
}
