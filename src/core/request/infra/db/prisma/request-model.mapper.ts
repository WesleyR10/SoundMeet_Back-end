import { Request, RequestId } from "../../../domain/request.aggregate";

export type RequestModelProps = {
  id: string;
  eventId: string;
  audienceId: string;
  musicianId: string;
  libraryId: string | null;
  songTitle: string;
  artistName: string;
  message: string | null;
  status: string;
  rejectionReason: string | null;
  priority: number;
  votesCount: number;
  playedAt: Date | null;
  respondedAt: Date | null;
  created_at: Date;
  updated_at: Date;
};

export class RequestModelMapper {
  static toModel(entity: Request): RequestModelProps {
    const priority =
      entity.priority === "high" ? 2 : entity.priority === "medium" ? 1 : 0;

    return {
      id: entity.request_id.id,
      eventId: entity.event_id.id,
      audienceId: entity.audience_id.id,
      musicianId: entity.musician_id.id,
      libraryId: entity.library_id?.id ?? null,
      songTitle: entity.song_title.value,
      artistName: entity.artist || "",
      message: entity.message?.value || null,
      status: entity.status.value,
      rejectionReason: entity.rejection_reason,
      priority,
      votesCount: entity.votes_count,
      playedAt: entity.played_at,
      respondedAt: entity.responded_at,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: RequestModelProps): Request {
    return new Request({
      request_id: new RequestId(model.id),
      event_id: model.eventId,
      audience_id: model.audienceId,
      musician_id: model.musicianId,
      library_id: model.libraryId,
      song_title: model.songTitle,
      artist: model.artistName || null,
      message: model.message || undefined,
      status: model.status,
      rejection_reason: model.rejectionReason,
      votes_count: model.votesCount,
      played_at: model.playedAt,
      created_at: model.created_at,
      updated_at: model.updated_at,
      responded_at: model.respondedAt,
    });
  }
}
