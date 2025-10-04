import { Request, RequestId } from "../../../domain/request.aggregate";

export type RequestModelProps = {
  id: string;
  eventId: string;
  audienceId: string;
  musicianId: string;
  libraryId?: string | null;
  songTitle: string;
  artistName: string;
  message?: string | null;
  status: string;
  priority: number;
  votesCount: number;
  playedAt?: Date | null;
  created_at: Date;
  updated_at: Date;
};

export class RequestModelMapper {
  static toModel(entity: Request): RequestModelProps {
    return {
      id: entity.id.id,
      eventId: "default-event-id", // Campo obrigatório no Prisma - usar valor padrão temporário
      audienceId: entity.audience_id.id,
      musicianId: entity.musician_id.id,
      libraryId: null, // Campo opcional no Prisma
      songTitle: entity.song_title.value,
      artistName: entity.artist || "",
      message: entity.message?.value || null,
      status: entity.status.value,
      priority: 1, // Campo obrigatório no Prisma, usando valor padrão
      votesCount: 0, // Campo obrigatório no Prisma, usando valor padrão
      playedAt: null, // Campo opcional no Prisma
      created_at: entity.created_at,
      updated_at: entity.created_at, // Usando created_at como fallback
    };
  }

  static toEntity(model: RequestModelProps): Request {
    return new Request({
      id: new RequestId(model.id),
      audience_id: model.audienceId,
      musician_id: model.musicianId,
      song_title: model.songTitle,
      artist: model.artistName || null,
      message: model.message || undefined,
      status: model.status,
      created_at: model.created_at,
    });
  }
}
