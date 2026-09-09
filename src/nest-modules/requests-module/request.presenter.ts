import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

import { RequestFeedbackOutput } from "../../core/request/application/use-cases/common/request-feedback-output";
import {
  RequestBoostOutput,
  RequestOutput,
} from "../../core/request/application/use-cases/common/request-output";
import { GetMusicianRequestsOutput } from "../../core/request/application/use-cases/get-musician-requests/get-musician-requests.use-case";
import { GetRequestBoostPaymentOutput } from "../../core/request/application/use-cases/get-request-boost-payment/get-request-boost-payment.use-case";
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

/**
 * Destaque pago, na resposta HTTP.
 *
 * 🔴 `dedication` sai cru: toda rota que devolve `RequestPresenter` é
 * participante-escopada (`assertRequestParticipant`), e o músico precisa ler a
 * dedicatória para decidir se aceita. O portão do público é
 * `Request.publicDedication`, usado pelo "tocando agora".
 *
 * `is_boosting` (e não `status`) é o que a UI deve consultar para decidir se
 * mostra o selo de destaque — `expired` e `cancelled` são pedidos comuns.
 */
export class RequestBoostPresenter {
  amount: number;
  dedication: string | null;
  status: string;
  tip_id: string | null;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  promised_at: Date;
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  charged_at: Date | null;
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  paid_at: Date | null;
  cancellation_reason: string | null;
  is_boosting: boolean;
  is_public: boolean;

  constructor(boost: RequestBoostOutput) {
    this.amount = boost.amount;
    this.dedication = boost.dedication;
    this.status = boost.status;
    this.tip_id = boost.tip_id;
    this.promised_at = boost.promised_at;
    this.charged_at = boost.charged_at;
    this.paid_at = boost.paid_at;
    this.cancellation_reason = boost.cancellation_reason;
    this.is_boosting = boost.is_boosting;
    this.is_public = boost.is_public;
  }
}

/** Cobrança do destaque — o QR que o fã precisa para pagar. */
export class RequestBoostPaymentPresenter {
  request_id: string;
  song_title: string;
  artist: string | null;
  amount: number;
  dedication: string | null;
  status: string;
  tip_id: string | null;
  qr_code: string | null;
  copy_paste_code: string | null;
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  expires_at: Date | null;

  constructor(output: GetRequestBoostPaymentOutput) {
    this.request_id = output.request_id;
    this.song_title = output.song_title;
    this.artist = output.artist;
    this.amount = output.amount;
    this.dedication = output.dedication;
    this.status = output.status;
    this.tip_id = output.tip_id;
    this.qr_code = output.qr_code;
    this.copy_paste_code = output.copy_paste_code;
    this.expires_at = output.expires_at;
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
  @ApiProperty({ type: () => RequestBoostPresenter, nullable: true })
  boost: RequestBoostPresenter | null;
  is_boosted: boolean;
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
    this.boost = output.boost ? new RequestBoostPresenter(output.boost) : null;
    this.is_boosted = output.is_boosted;
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
  /**
   * O músico consegue receber gorjeta. `false` esconde o destaque pago na tela
   * do fã — oferecer algo que a escrita vai recusar é pior que não oferecer.
   */
  accepts_tips: boolean;

  constructor(output: GetRequestSuggestionsOutput) {
    this.musician_id = output.musician_id;
    this.genres = output.genres;
    this.suggestions = output.suggestions;
    this.accepts_tips = output.accepts_tips;
  }
}

export class RequestFeedbackPresenter {
  id: string;
  request_id: string;
  rating: number;
  comment: string | null;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  has_comment: boolean;
  is_positive: boolean;
  is_neutral: boolean;
  is_negative: boolean;

  constructor(output: RequestFeedbackOutput) {
    this.id = output.id;
    this.request_id = output.request_id;
    this.rating = output.rating;
    this.comment = output.comment;
    this.created_at = output.created_at;
    this.has_comment = output.has_comment;
    this.is_positive = output.is_positive;
    this.is_neutral = output.is_neutral;
    this.is_negative = output.is_negative;
  }
}
