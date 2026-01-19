import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

import { RequestOutput } from "../../core/request/application/use-cases/common/request-output";
import { GetMusicianRequestsOutput } from "../../core/request/application/use-cases/get-musician-requests/get-musician-requests.use-case";
import { GetRequestSuggestionsOutput } from "../../core/request/application/use-cases/get-request-suggestions/get-request-suggestions.use-case";
import { ListRequestsOutput } from "../../core/request/application/use-cases/list-requests/list-requests.use-case";
import { CollectionPresenter } from "../shared-module/collection.presenter";

export class RequestPointsPresenter {
  value: number;
  source: string;
  description?: string;
  metadata?: Record<string, any>;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  earnedAt: Date;

  constructor(points: RequestOutput["points_value"]) {
    this.value = points.value;
    this.source = points.source;
    this.description = points.description;
    this.metadata = points.metadata;
    this.earnedAt = points.earnedAt;
  }
}

export class RequestPresenter {
  id: string;
  event_id: string;
  audience_id: string;
  musician_id: string;
  library_id: string | null;
  song_title: string;
  artist: string | null;
  message: string | null;
  status: string;
  rejection_reason: string | null;
  votes_count: number;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  played_at: Date | null;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  responded_at: Date | null;
  is_pending: boolean;
  is_accepted: boolean;
  is_played: boolean;
  is_rejected: boolean;
  is_responded: boolean;
  has_message: boolean;
  display_title: string;
  age_in_minutes: number;
  is_recent: boolean;
  is_old: boolean;
  is_urgent: boolean;
  priority: "low" | "medium" | "high";
  @ApiProperty({ type: () => RequestPointsPresenter })
  points_value: RequestPointsPresenter;
  is_special_request: boolean;
  can_be_accepted: boolean;
  can_be_rejected: boolean;
  is_within_response_time: boolean;

  constructor(output: RequestOutput) {
    this.id = output.id;
    this.event_id = output.event_id;
    this.audience_id = output.audience_id;
    this.musician_id = output.musician_id;
    this.library_id = output.library_id;
    this.song_title = output.song_title;
    this.artist = output.artist;
    this.message = output.message;
    this.status = output.status;
    this.rejection_reason = output.rejection_reason;
    this.votes_count = output.votes_count;
    this.created_at = output.created_at;
    this.played_at = output.played_at;
    this.updated_at = output.updated_at;
    this.responded_at = output.responded_at;
    this.is_pending = output.is_pending;
    this.is_accepted = output.is_accepted;
    this.is_played = output.is_played;
    this.is_rejected = output.is_rejected;
    this.is_responded = output.is_responded;
    this.has_message = output.has_message;
    this.display_title = output.display_title;
    this.age_in_minutes = output.age_in_minutes;
    this.is_recent = output.is_recent;
    this.is_old = output.is_old;
    this.is_urgent = output.is_urgent;
    this.priority = output.priority;
    this.points_value = new RequestPointsPresenter(output.points_value);
    this.is_special_request = output.is_special_request;
    this.can_be_accepted = output.can_be_accepted;
    this.can_be_rejected = output.can_be_rejected;
    this.is_within_response_time = output.is_within_response_time;
  }
}

export class RequestCollectionPresenter extends CollectionPresenter {
  data: RequestPresenter[];

  constructor(output: ListRequestsOutput) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new RequestPresenter(i));
  }
}

export class MusicianRequestsPresenter {
  requests: RequestPresenter[];
  total_count: number;
  pending_count: number;

  constructor(output: GetMusicianRequestsOutput) {
    this.requests = output.requests.map(
      (request) => new RequestPresenter(request),
    );
    this.total_count = output.total_count;
    this.pending_count = output.pending_count;
  }
}

export class RequestSuggestionsPresenter {
  musician_id: string;
  genres: string[];
  suggestions: GetRequestSuggestionsOutput["suggestions"];

  constructor(output: GetRequestSuggestionsOutput) {
    this.musician_id = output.musician_id;
    this.genres = output.genres;
    this.suggestions = output.suggestions;
  }
}
