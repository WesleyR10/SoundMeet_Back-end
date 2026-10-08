import {
  EstablishmentId,
  IEstablishmentRepository,
} from "../../../../establishment/domain";
import { IMusicianRepository, MusicianId } from "../../../../musician/domain";
import { FollowTarget } from "../../../domain/follow-types";
import { FollowTargetSummary } from "./follow-output";

/**
 * O alvo pode ser seguido — e, se pode, como ele se apresenta.
 *
 * 🔴 Músico só com `open_to_gigs === true`, a mesma regra da busca do fã
 * (`MusicianSearchParams.createPublic`). Quem criou a conta só para estudar
 * não aparece na busca e também não pode ser seguido: um follow por id, vindo
 * de link antigo ou chamada direta, furaria a decisão de privacidade que a
 * busca já toma. Inativo/oculto responde como inexistente.
 */
export class FollowTargetReader {
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    private readonly establishmentRepo: IEstablishmentRepository,
  ) {}

  async findVisible(target: FollowTarget): Promise<FollowTargetSummary | null> {
    const map = await this.findVisibleMany([target]);
    return map.get(FollowTargetReader.key(target)) ?? null;
  }

  async findVisibleMany(
    targets: FollowTarget[],
  ): Promise<Map<string, FollowTargetSummary>> {
    const result = new Map<string, FollowTargetSummary>();

    const musicianIds = targets
      .filter((t) => t.target_type === "musician")
      .map((t) => t.target_id);
    const establishmentIds = targets
      .filter((t) => t.target_type === "establishment")
      .map((t) => t.target_id);

    if (musicianIds.length) {
      const musicians = await this.musicianRepo.findByIds(
        musicianIds.map((id) => new MusicianId(id)),
      );
      for (const m of musicians) {
        if (!m.is_active || m.open_to_gigs !== true) continue;
        result.set(
          FollowTargetReader.key({
            target_type: "musician",
            target_id: m.musician_id.id,
          }),
          {
            name: (m.stage_name?.trim() || m.name).trim(),
            avatar: m.avatar ?? null,
          },
        );
      }
    }

    if (establishmentIds.length) {
      const establishments = await this.establishmentRepo.findByIds(
        establishmentIds.map((id) => new EstablishmentId(id)),
      );
      for (const e of establishments) {
        if (!e.is_active) continue;
        result.set(
          FollowTargetReader.key({
            target_type: "establishment",
            target_id: e.establishment_id.id,
          }),
          { name: e.name, avatar: e.avatar ?? null },
        );
      }
    }

    return result;
  }

  static key(target: FollowTarget): string {
    return `${target.target_type}:${target.target_id}`;
  }
}
