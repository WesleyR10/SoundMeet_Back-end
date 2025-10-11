import { UserInteraction } from "../../../domain/user-interaction.aggregate";
import { UserInteractionId } from "../../../domain/value-objects/gamification-id.vo";
import { InteractionMetadata } from "../../../domain/value-objects/interaction-metadata.vo";

export type UserInteractionModelProps = {
  id: string;
  audienceId: string;
  musicianId: string | null;
  type: string;
  metadata: any; // Usando any para compatibilidade com Prisma JsonValue
  points: number;
  created_at: Date;
};

export class UserInteractionModelMapper {
  static toModel(entity: UserInteraction): UserInteractionModelProps {
    return {
      id: entity.id.id,
      audienceId: entity.user_id.id,
      musicianId: entity.target_id,
      type: entity.interaction_type,
      metadata: entity.metadata as any, // Cast para compatibilidade com Prisma
      points: entity.points_earned,
      created_at: entity.created_at,
    };
  }

  static toEntity(model: UserInteractionModelProps): UserInteraction {
    return new UserInteraction({
      id: new UserInteractionId(model.id),
      user_id: model.audienceId,
      interaction_type: model.type,
      target_id: model.musicianId,
      metadata: model.metadata as InteractionMetadata, // Cast de volta para o tipo domain
      points_earned: model.points,
      created_at: model.created_at,
      // Como o Prisma não possui updated_at para este modelo, alinhar ao padrão: usar created_at
      updated_at: model.created_at,
    });
  }
}
