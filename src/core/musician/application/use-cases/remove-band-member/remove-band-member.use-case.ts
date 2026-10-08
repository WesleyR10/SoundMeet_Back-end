import { IUseCase } from "../../../../shared/application/use-case.interface";
import { InvalidOperationError } from "../../../../shared/domain/errors/invalid-operation.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Band, BandId } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { MusicianId } from "../../../domain/musician.aggregate";
import { assertBandLeader } from "../common/band-actor";
import { BandOutput, BandOutputMapper } from "../common/band-output";
import { RemoveBandMemberInput } from "./remove-band-member.input";

/**
 * Tira um músico da banda. Três situações passam pela mesma rota
 * (`DELETE /bands/:id/members/:musician_id`):
 *
 *  - o líder remove um integrante;
 *  - o líder cancela um convite pendente (ou limpa um recusado);
 *  - **o próprio músico sai** — integrante que deixa a banda, ou convidado que
 *    desiste do convite.
 *
 * 🔴 A terceira não existia. A rota era guardada pelo `BandOwnershipGuard`
 * (claim `band_ids`, só do criador), então quem aceitava um convite ficava
 * preso: aparecia como integrante da banda, entrava na divisão da gorjeta, e
 * não tinha como sair sem pedir ao líder. Entrar exigia o aceite do músico;
 * sair tem de depender só dele também.
 */
export class RemoveBandMemberUseCase implements IUseCase<
  RemoveBandMemberInput,
  BandOutput
> {
  constructor(private readonly bandRepo: IBandRepository) {}

  async execute(input: RemoveBandMemberInput): Promise<BandOutput> {
    const bandId = new BandId(input.band_id);
    const band = await this.bandRepo.findById(bandId);

    if (!band) {
      throw new NotFoundError(input.band_id, Band);
    }

    const musicianId = new MusicianId(input.musician_id);
    const isSelf =
      !!input.requesting_musician_id &&
      input.requesting_musician_id === input.musician_id;

    // Tirar OUTRA pessoa é decisão do líder. Tirar a si mesmo, não.
    if (!isSelf) {
      assertBandLeader(band, input, "remover integrantes");
    }

    // O agregado deixa o líder sair quando é o último integrante. Por HTTP
    // isso deixaria uma banda sem ninguém: sem quem a edite, a apague ou
    // responda por ela. O caminho para "não quero mais esta banda" é dissolver.
    if (band.isLeader(musicianId) && band.members.length === 1) {
      throw new InvalidOperationError(
        "Você é o único integrante. Para encerrar a banda, dissolva-a.",
      );
    }

    band.removeMember(musicianId);

    if (band.notification.hasErrors()) {
      throw new EntityValidationError(band.notification.toJSON());
    }

    await this.bandRepo.update(band);

    return BandOutputMapper.toOutput(band);
  }
}
