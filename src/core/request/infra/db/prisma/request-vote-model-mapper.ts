import { RequestVote as PrismaRequestVote } from "@prisma/client";

import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import {
  RequestVote,
  RequestVoteId,
} from "../../../domain/request-vote.aggregate";

export type RequestVoteModelProps = {
  id: string;
  requestId: string;
  audienceId: string;
  voteType: string;
  created_at: Date;
};

export class RequestVoteModelMapper {
  static toModel(entity: RequestVote): RequestVoteModelProps {
    return {
      id: entity.request_vote_id.id,
      requestId: entity.request_id.id,
      audienceId: entity.audience_id.id,
      voteType: entity.vote_type,
      created_at: entity.created_at,
    };
  }

  static toEntity(
    model: PrismaRequestVote | RequestVoteModelProps,
  ): RequestVote {
    const entity = new RequestVote({
      request_vote_id: new RequestVoteId(model.id),
      request_id: model.requestId,
      audience_id: model.audienceId,
      vote_type: model.voteType,
      created_at: model.created_at,
    });

    entity.validate();
    if (entity.notification.hasErrors()) {
      throw new LoadEntityError(entity.notification.toJSON());
    }

    return entity;
  }
}
