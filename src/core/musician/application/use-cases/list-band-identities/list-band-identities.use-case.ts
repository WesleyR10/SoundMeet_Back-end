import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { BandId } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";

/** Teto de ids por chamada — o mesmo de `MUSICIAN_IDENTITIES_MAX`. */
export const BAND_IDENTITIES_MAX = 50;

export type ListBandIdentitiesInput = {
  ids: string[];
};

export type BandIdentityOutput = {
  id: string;
  /** O nome da banda — mesma chave da identidade de músico, de propósito. */
  display_name: string;
  avatar: string | null;
  genres: string[];
  /** O que a banda toca: instrumentos dos integrantes ACEITOS, sem repetir. */
  instruments: string[];
};

export type ListBandIdentitiesOutput = {
  items: BandIdentityOutput[];
};

/**
 * Quem são estas bandas — nome, foto e o que tocam, várias de uma vez.
 *
 * É o par de `ListMusicianIdentitiesUseCase`. Toda lista do painel que guarda
 * só o `band_id` (line-up, contratações, conversas) resolvia o nome com um
 * `GET /bands/:id` POR banda: o agregado inteiro, com integrantes e endereço,
 * para ler dois campos.
 *
 * **Não passa pelo gate de `open_to_gigs`, e é de propósito** — mesma razão
 * do músico: o gate decide quem aparece na DESCOBERTA; isto resolve ids que o
 * chamador já tem. Uma banda contratada precisa continuar tendo nome com o
 * radar desligado, e a banda dissolvida (arquivada) precisa continuar tendo
 * nome nos shows que fez. Sem o id, não vem nada.
 */
export class ListBandIdentitiesUseCase implements IUseCase<
  ListBandIdentitiesInput,
  ListBandIdentitiesOutput
> {
  constructor(private readonly bandRepo: IBandRepository) {}

  async execute(
    input: ListBandIdentitiesInput,
  ): Promise<ListBandIdentitiesOutput> {
    const uniqueIds = [...new Set(input.ids)];

    if (uniqueIds.length > BAND_IDENTITIES_MAX) {
      throw new EntityValidationError([
        {
          ids: [
            `ids must contain no more than ${BAND_IDENTITIES_MAX} elements`,
          ],
        },
      ]);
    }

    if (uniqueIds.length === 0) {
      return { items: [] };
    }

    const found = await this.bandRepo.findByIds(
      uniqueIds.map((id) => new BandId(id)),
    );
    const byId = new Map(found.map((band) => [band.band_id.id, band]));

    // Na ordem em que foram pedidos; id que não existe simplesmente não volta
    // (banda apagada não pode transformar a lista inteira em erro).
    const items = uniqueIds.flatMap((id) => {
      const band = byId.get(id);
      if (!band) return [];
      return [
        {
          id: band.band_id.id,
          display_name: band.name,
          avatar: band.avatar,
          genres: band.genres,
          instruments: [
            ...new Set(
              band.acceptedMembers
                .map((member) => member.instrument)
                // "N/A" é o marcador do líder que ainda não declarou o que toca.
                .filter((instrument) => !!instrument && instrument !== "N/A"),
            ),
          ],
        },
      ];
    });

    return { items };
  }
}
