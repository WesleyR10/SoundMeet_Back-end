import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ConflictError } from "../../../../shared/domain/errors";
import { Indication } from "../../../domain/indication.aggregate";
import { IIndicationRepository } from "../../../domain/indication.repository";
import {
  IndicationOutput,
  IndicationOutputMapper,
} from "../common/indication-output";

export type RecordIndicationInput = {
  audience_id: string;
  musician_id: string;
  establishment_id: string;
  message?: string | null;
};

/**
 * Persiste a indicação.
 *
 * ⚠️ **Idempotente por trio.** Chamado a partir de `MusicianIndicatedEvent`, e
 * eventos podem ser reentregues; além disso, o mesmo fã indicando o mesmo
 * músico para a mesma casa de novo é a mesma opinião, repetida. Repetir devolve
 * a indicação existente em vez de estourar — quem grava a garantia dura é o
 * índice único no banco, e o `ConflictError` que ele produz numa corrida também
 * cai no caminho de releitura.
 */
export class RecordIndicationUseCase implements IUseCase<
  RecordIndicationInput,
  IndicationOutput
> {
  constructor(private readonly indicationRepo: IIndicationRepository) {}

  async execute(input: RecordIndicationInput): Promise<IndicationOutput> {
    const existing = await this.indicationRepo.findByTrio({
      audience_id: input.audience_id,
      musician_id: input.musician_id,
      establishment_id: input.establishment_id,
    });
    if (existing) {
      return IndicationOutputMapper.toOutput(existing);
    }

    const indication = Indication.create({
      audience_id: input.audience_id,
      musician_id: input.musician_id,
      establishment_id: input.establishment_id,
      message: input.message ?? null,
    });

    try {
      await this.indicationRepo.insert(indication);
    } catch (error) {
      // Corrida: os dois pedidos passaram pelo `findByTrio` antes de qualquer
      // insert, e o UNIQUE decidiu. Reler devolve o vencedor — nenhum dos dois
      // usuários vê erro, porque nenhum dos dois fez nada errado.
      if (error instanceof ConflictError) {
        const winner = await this.indicationRepo.findByTrio({
          audience_id: input.audience_id,
          musician_id: input.musician_id,
          establishment_id: input.establishment_id,
        });
        if (winner) return IndicationOutputMapper.toOutput(winner);
      }
      throw error;
    }

    return IndicationOutputMapper.toOutput(indication);
  }
}
