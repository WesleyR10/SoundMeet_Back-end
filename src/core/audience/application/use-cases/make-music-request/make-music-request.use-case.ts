import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
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
  constructor(private audienceRepository: IAudienceRepository) {}

  async execute(input: MakeMusicRequestInput): Promise<MakeMusicRequestOutput> {
    // Find the audience
    const audience = await this.audienceRepository.findById(
      new AudienceId(input.id),
    );

    if (!audience) {
      throw new NotFoundError(input.id, Audience);
    }

    audience.makeMusicRequest(
      input.musician_id,
      input.song_title,
      input.artist_name,
    );

    // Check if audience should get "Sugestor" badge
    const currentBadges = audience.getBadges();
    const newBadges: string[] = [];
    if (!currentBadges.includes("Sugestor")) {
      audience.addBadge("Sugestor");
      newBadges.push("Sugestor");
    }

    // Save the updated audience
    await this.audienceRepository.update(audience);

    const requestMetadata: MakeMusicRequestOutput["request_metadata"] = {
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
      new_badges: newBadges,
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
