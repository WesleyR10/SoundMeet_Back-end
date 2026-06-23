import {
  InvalidUuidError,
  Uuid,
} from "../../../shared/domain/value-objects/uuid.vo";
import { RequestVote, RequestVoteId } from "../request-vote.aggregate";
import { RequestVoteType } from "../value-objects/request-vote-type.vo";

describe("RequestVote Unit Tests", () => {
  test("should create a vote with valid data", () => {
    const request_id = new Uuid().id;
    const audience_id = new Uuid().id;

    const vote = RequestVote.create({
      request_id,
      audience_id,
      vote_type: RequestVoteType.UP,
    });

    expect(vote.request_vote_id).toBeInstanceOf(RequestVoteId);
    expect(vote.request_id).toBeInstanceOf(Uuid);
    expect(vote.audience_id).toBeInstanceOf(Uuid);
    expect(vote.vote_type).toBe(RequestVoteType.UP);
    expect(vote.created_at).toBeInstanceOf(Date);

    expect(vote.toJSON()).toEqual(
      expect.objectContaining({
        request_vote_id: vote.request_vote_id.id,
        request_id,
        audience_id,
        vote_type: RequestVoteType.UP,
      }),
    );
  });

  test("should default to UP vote when vote_type is invalid", () => {
    const vote = RequestVote.create({
      request_id: new Uuid().id,
      audience_id: new Uuid().id,
      vote_type: "invalid",
    });

    expect(vote.vote_type).toBe(RequestVoteType.UP);
  });

  test("should throw error when request_id is invalid uuid", () => {
    expect(() =>
      RequestVote.create({
        request_id: "invalid-uuid",
        audience_id: new Uuid().id,
        vote_type: RequestVoteType.UP,
      }),
    ).toThrow(InvalidUuidError);
  });
});
