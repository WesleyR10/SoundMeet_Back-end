import { ForbiddenException } from "@nestjs/common";

import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Request } from "../../../../domain/request.aggregate";
import { RequestInMemoryRepository } from "../../../../infra/db/in-memory/request-in-memory.repository";
import { RequestFeedbackInMemoryRepository } from "../../../../infra/db/in-memory/request-feedback-in-memory.repository";
import { CreateRequestFeedbackInput } from "../create-request-feedback.input";
import { CreateRequestFeedbackUseCase } from "../create-request-feedback.use-case";

describe("CreateRequestFeedbackUseCase Unit Tests", () => {
  let useCase: CreateRequestFeedbackUseCase;
  let requestRepo: RequestInMemoryRepository;
  let feedbackRepo: RequestFeedbackInMemoryRepository;

  beforeEach(() => {
    requestRepo = new RequestInMemoryRepository();
    feedbackRepo = new RequestFeedbackInMemoryRepository();
    useCase = new CreateRequestFeedbackUseCase(feedbackRepo, requestRepo);
  });

  test("should allow the target musician to create feedback", async () => {
    const musician_id = new Uuid().id;
    const request = Request.create({
      event_id: new Uuid().id,
      audience_id: new Uuid().id,
      musician_id,
      song_title: "Song",
    });
    await requestRepo.insert(request);

    const output = await useCase.execute(
      new CreateRequestFeedbackInput({
        request_id: request.request_id.id,
        rating: 5,
        comment: "Great!",
        musician_id,
      }),
    );

    expect(output.request_id).toBe(request.request_id.id);
    expect(output.rating).toBe(5);
  });

  test("should throw ForbiddenException when caller is not the request's target musician", async () => {
    const request = Request.create({
      event_id: new Uuid().id,
      audience_id: new Uuid().id,
      musician_id: new Uuid().id,
      song_title: "Song",
    });
    await requestRepo.insert(request);

    const otherMusicianId = new Uuid().id;

    await expect(() =>
      useCase.execute(
        new CreateRequestFeedbackInput({
          request_id: request.request_id.id,
          rating: 5,
          musician_id: otherMusicianId,
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  test("should allow admin (musician_id undefined) to create feedback on any request", async () => {
    const request = Request.create({
      event_id: new Uuid().id,
      audience_id: new Uuid().id,
      musician_id: new Uuid().id,
      song_title: "Song",
    });
    await requestRepo.insert(request);

    const output = await useCase.execute(
      new CreateRequestFeedbackInput({
        request_id: request.request_id.id,
        rating: 4,
      }),
    );

    expect(output.rating).toBe(4);
  });
});
