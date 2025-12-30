import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IAudienceRepository } from "../../../domain/audience.repository";
import { Audience, AudienceId } from "../../../domain/audience.aggregate";
import { MakeMusicRequestInput } from "./make-music-request.input";
import {
  AudienceOutput,
  AudienceOutputMapper,
} from "../common/audience-output";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Points } from "../../../../shared/domain/value-objects/points.vo";

export class MakeMusicRequestUseCase implements IUseCase<
  MakeMusicRequestInput,
  MakeMusicRequestOutput
> {
  constructor(private audienceRepository: IAudienceRepository) {}

  async execute(input: MakeMusicRequestInput): Promise<MakeMusicRequestOutput> {
    // Validate input
    if (!input.song_title?.trim()) {
      throw new Error("Song title is required");
    }

    if (!input.artist_name?.trim()) {
      throw new Error("Artist name is required");
    }

    // Find the audience
    const audience = await this.audienceRepository.findById(
      new AudienceId(input.id),
    );

    if (!audience) {
      throw new NotFoundError(input.id, Audience);
    }

    // Check if audience can make request
    if (!audience.canMakeRequest()) {
      throw new Error(
        "Audience has reached the maximum number of requests for this event",
      );
    }

    // Make the music request (this already adds points and updates level internally)
    audience.makeMusicRequest(
      input.musician_id,
      input.song_title.trim(),
      input.artist_name.trim(),
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

    // Build request metadata with only defined fields
    const requestMetadata: any = {
      musician_id: input.musician_id,
      song_title: input.song_title.trim(),
      artist_name: input.artist_name.trim(),
      requested_at: new Date(),
      status: "pending" as const,
    };

    // Only include optional fields if they are provided
    if (input.genre) requestMetadata.genre = input.genre;
    if (input.difficulty) requestMetadata.difficulty = input.difficulty;
    if (input.event_id) requestMetadata.event_id = input.event_id;
    if (input.establishment_id)
      requestMetadata.establishment_id = input.establishment_id;
    if (input.message) requestMetadata.message = input.message;
    if (input.is_priority !== undefined)
      requestMetadata.is_priority = input.is_priority;

    return {
      audience: AudienceOutputMapper.toOutput(audience),
      points_earned: 25, // Points for making a request
      new_badges: newBadges,
      new_level: audience.currentLevel,
      request_metadata: requestMetadata,
    };
  }

  private async validateMusicRequest(
    input: MakeMusicRequestInput,
  ): Promise<void> {
    // Validar se o músico existe
    // Validar se a música não está na lista de bloqueadas
    // Validar se não é spam (mesmo pedido recente)

    if (!input.song_title?.trim() || !input.artist_name?.trim()) {
      throw new Error("Título da música e nome do artista são obrigatórios");
    }

    if (input.song_title.length > 100 || input.artist_name.length > 100) {
      throw new Error(
        "Título da música e nome do artista devem ter no máximo 100 caracteres",
      );
    }

    if (input.message && input.message.length > 500) {
      throw new Error("Mensagem deve ter no máximo 500 caracteres");
    }
  }

  private async sendRequestToMusician(
    input: MakeMusicRequestInput,
  ): Promise<void> {
    // Implementar envio via RabbitMQ para o músico
    // Por enquanto, apenas log
    console.log(
      `Pedido musical enviado para músico ${input.musician_id}: ${input.song_title} - ${input.artist_name}`,
    );
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
