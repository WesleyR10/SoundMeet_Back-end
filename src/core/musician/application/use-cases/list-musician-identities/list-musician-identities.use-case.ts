import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";

/** Teto de ids por chamada — o tamanho de uma página de lista, com folga. */
export const MUSICIAN_IDENTITIES_MAX = 50;

export type ListMusicianIdentitiesInput = {
  ids: string[];
};

export type MusicianIdentityOutput = {
  id: string;
  /** `stage_name ?? name` — o mesmo que `Musician.displayName`. */
  display_name: string;
  avatar: string | null;
  instruments: string[];
  genres: string[];
  rating: number;
  total_ratings: number;
  is_verified: boolean;
};

export type ListMusicianIdentitiesOutput = {
  items: MusicianIdentityOutput[];
};

/**
 * Quem são estes músicos — nome exibido, foto e o que tocam, vários de uma vez.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O QUE ISTO SUBSTITUI
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Toda lista do painel que guarda só o `musician_id` (line-up, contratações,
 * conversas) resolvia o nome com um `GET /musicians/:id` POR artista: perfil
 * inteiro, QR, faixa de preço e uma consulta de plano, para ler três campos.
 * Uma tela com vinte artistas eram vinte requisições saindo do mesmo IP — é o
 * custo que o `UserThrottlerGuard` documenta como o que esgotava a cota do
 * painel.
 *
 * Aqui é UMA consulta com `select` enxuto.
 *
 * **Não passa pelo gate de `open_to_gigs`, e é de propósito.** O gate decide
 * quem aparece na DESCOBERTA. Isto resolve ids que o chamador já tem — um
 * artista escalado ou contratado precisa continuar tendo nome mesmo com o
 * radar desligado, exatamente como já acontecia em `GET /musicians/:id`. Não
 * há como listar ou adivinhar músicos por aqui: sem o id, não vem nada.
 */
export class ListMusicianIdentitiesUseCase implements IUseCase<
  ListMusicianIdentitiesInput,
  ListMusicianIdentitiesOutput
> {
  constructor(private readonly musicianRepo: IMusicianRepository) {}

  async execute(
    input: ListMusicianIdentitiesInput,
  ): Promise<ListMusicianIdentitiesOutput> {
    const uniqueIds = [...new Set(input.ids)];

    if (uniqueIds.length > MUSICIAN_IDENTITIES_MAX) {
      throw new EntityValidationError([
        {
          ids: [
            `ids must contain no more than ${MUSICIAN_IDENTITIES_MAX} elements`,
          ],
        },
      ]);
    }

    if (uniqueIds.length === 0) {
      return { items: [] };
    }

    const found = await this.musicianRepo.findIdentitiesByIds(
      uniqueIds.map((id) => new MusicianId(id)),
    );
    const byId = new Map(found.map((identity) => [identity.id, identity]));

    // Na ordem em que foram pedidos; id que não existe simplesmente não volta
    // (músico apagado não pode transformar a lista inteira em erro).
    const items = uniqueIds.flatMap((id) => {
      const identity = byId.get(id);
      if (!identity) return [];
      return [
        {
          id: identity.id,
          display_name: identity.stage_name || identity.name,
          avatar: identity.avatar,
          instruments: identity.instruments,
          genres: identity.genres,
          rating: identity.rating,
          total_ratings: identity.total_ratings,
          is_verified: identity.is_verified,
        },
      ];
    });

    return { items };
  }
}
