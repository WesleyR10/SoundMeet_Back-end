import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Request, RequestId } from "../../../domain/request.aggregate";
import { IRequestRepository } from "../../../domain/request.repository";
import { RequestVote } from "../../../domain/request-vote.aggregate";
import { IRequestVoteRepository } from "../../../domain/request-vote.repository";
import { RequestOutput, RequestOutputMapper } from "../common/request-output";
import { VoteRequestInput } from "./vote-request.input";

export class VoteRequestUseCase implements IUseCase<
  VoteRequestInput,
  RequestOutput
> {
  constructor(
    private readonly requestRepo: IRequestRepository,
    private readonly requestVoteRepo: IRequestVoteRepository,
  ) {}

  async execute(input: VoteRequestInput): Promise<RequestOutput> {
    const request = await this.requestRepo.findById(
      new RequestId(input.request_id),
    );
    if (!request) {
      throw new NotFoundError(input.request_id, Request);
    }

    const existing = await this.requestVoteRepo.findByRequestAndAudience(
      input.request_id,
      input.audience_id,
    );

    if (existing) {
      existing.changeVoteType(input.vote_type);
      if (existing.notification.hasErrors()) {
        throw new EntityValidationError(existing.notification.toJSON());
      }
      await this.requestVoteRepo.update(existing);
    } else {
      const vote = RequestVote.create({
        request_id: input.request_id,
        audience_id: input.audience_id,
        vote_type: input.vote_type,
      });
      if (vote.notification.hasErrors()) {
        throw new EntityValidationError(vote.notification.toJSON());
      }
      await this.requestVoteRepo.insert(vote);
    }

    const upVotes = await this.requestVoteRepo.countUpVotesByRequestId(
      input.request_id,
    );
    request.updateVotesCount(upVotes);
    if (request.notification.hasErrors()) {
      throw new EntityValidationError(request.notification.toJSON());
    }
    await this.requestRepo.update(request);

    return RequestOutputMapper.toOutput(request);
  }
}
