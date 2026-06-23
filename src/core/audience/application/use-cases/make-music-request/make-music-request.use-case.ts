import { PointsSourceEnum } from "../../../../gamification/domain/value-objects/points-source.vo";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Audience, AudienceId } from "../../../domain/audience.aggregate";
import { IAudienceRepository } from "../../../domain/audience.repository";
import {
  AudienceOutput,
  AudienceOutputMapper,
} from "../common/audience-output";
import { MakeMusicRequestInput } from "./make-music-request.input";

export class MakeMusicRequestUseCase implements IUseCase<
  MakeMusicRequestInput,
  MakeMusicRequestOutput
> {
  constructor(
    private audienceRepository: IAudienceRepository,
    private readonly createRequestUseCase: IUseCase<any, any>,
    private readonly addPointsUseCase: IUseCase<any, any>,
  ) {}

  async execute(input: MakeMusicRequestInput): Promise<MakeMusicRequestOutput> {
    // Find the audience
    const audience = await this.audienceRepository.findById(
      new AudienceId(input.id),
    );

    if (!audience) {
      throw new NotFoundError(input.id, Audience);
    }

    audience.ensureIsActive();
    if (audience.notification.hasErrors()) {
      throw new EntityValidationError(audience.notification.toJSON());
    }

    if (!input.event_id) {
      throw new InvalidArgumentError(
        "event_id is required to create a canonical music request",
      );
    }

    const request = await this.createRequestUseCase.execute({
      event_id: input.event_id,
      audience_id: input.id,
      musician_id: input.musician_id,
      song_title: input.song_title,
      artist: input.artist_name,
      message: input.message,
      library_id: input.metadata?.library_id ?? null,
    });

    await this.addPointsUseCase.execute({
      user_id: input.id,
      source: PointsSourceEnum.REQUEST,
      metadata: {
        request_id: request.id,
        musician_id: input.musician_id,
        event_id: input.event_id,
        description: "Pedido musical enviado",
      },
    });

    const requestMetadata: MakeMusicRequestOutput["request_metadata"] = {
      request_id: request.id,
      musician_id: input.musician_id,
      song_title: input.song_title,
      artist_name: input.artist_name,
      ...(input.genre ? { genre: input.genre } : {}),
      ...(input.difficulty ? { difficulty: input.difficulty } : {}),
      ...(input.event_id ? { event_id: input.event_id } : {}),
      ...(input.establishment_id
        ? { establishment_id: input.establishment_id }
        : {}),
      ...(input.message ? { message: input.message } : {}),
      ...(input.is_priority !== undefined
        ? { is_priority: input.is_priority }
        : {}),
      requested_at: new Date(),
      status: "pending",
    };

    return {
      audience: AudienceOutputMapper.toOutput(audience),
      points_earned: 25, // Points for making a request
      new_badges: [],
      new_level: audience.currentLevel,
      request_metadata: requestMetadata,
    };
  }
}

export type MakeMusicRequestOutput = {
  audience: AudienceOutput;
  points_earned: number;
  new_badges: string[];
  new_level: any; // Level type
  request_metadata: {
    request_id: string;
    musician_id: string;
    song_title: string;
    artist_name: string;
    genre?: string;
    difficulty?: string;
    event_id?: string;
    establishment_id?: string;
    message?: string;
    is_priority?: boolean;
    requested_at: Date;
    status: "pending" | "accepted" | "rejected";
  };
};
