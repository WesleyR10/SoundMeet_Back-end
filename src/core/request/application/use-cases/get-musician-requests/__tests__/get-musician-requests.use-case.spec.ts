import { RequestInMemoryRepository } from "../../../../infra/db/in-memory/request-in-memory.repository";
import { GetMusicianRequestsUseCase } from "../get-musician-requests.use-case";
import {
  GetMusicianRequestsInput,
  MusicianRequestsStatusFilter,
} from "../get-musician-requests.input";
import { Request } from "../../../../domain/request.aggregate";
import { RequestStatus } from "../../../../domain/value-objects/request-status.vo";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";

describe("GetMusicianRequestsUseCase Unit Tests", () => {
  let useCase: GetMusicianRequestsUseCase;
  let repository: RequestInMemoryRepository;

  beforeEach(() => {
    repository = new RequestInMemoryRepository();
    useCase = new GetMusicianRequestsUseCase(repository);
  });

  it("should return empty list when musician has no requests", async () => {
    const musicianId = new Uuid();
    const input = new GetMusicianRequestsInput({
      musician_id: musicianId.id,
    });

    const output = await useCase.execute(input);

    expect(output.requests).toHaveLength(0);
    expect(output.total_count).toBe(0);
    expect(output.pending_count).toBe(0);
  });

  it("should return all requests for a musician", async () => {
    const musicianId = new Uuid();
    const otherMusicianId = new Uuid();

    const musicianRequests = [
      Request.fake().aRequest().withMusicianId(musicianId).build(),
      Request.fake().aRequest().withMusicianId(musicianId).build(),
      Request.fake().aRequest().withMusicianId(musicianId).build(),
    ];

    const otherRequests = [
      Request.fake().aRequest().withMusicianId(otherMusicianId).build(),
    ];

    await repository.bulkInsert([...musicianRequests, ...otherRequests]);

    const input = new GetMusicianRequestsInput({
      musician_id: musicianId.id,
    });

    const output = await useCase.execute(input);

    expect(output.requests).toHaveLength(3);
    expect(output.total_count).toBe(3);
    expect(output.pending_count).toBe(3); // All are pending by default
    output.requests.forEach((request) => {
      expect(request.musician_id).toBe(musicianId.id);
    });
  });

  it("should filter requests by PENDING status", async () => {
    const musicianId = new Uuid();

    const pendingRequest = Request.fake()
      .aRequest()
      .withMusicianId(musicianId)
      .build();
    const acceptedRequest = Request.fake()
      .aRequest()
      .withMusicianId(musicianId)
      .build();
    acceptedRequest.accept();
    const rejectedRequest = Request.fake()
      .aRequest()
      .withMusicianId(musicianId)
      .build();
    rejectedRequest.reject("Not available");

    await repository.bulkInsert([
      pendingRequest,
      acceptedRequest,
      rejectedRequest,
    ]);

    const input = new GetMusicianRequestsInput({
      musician_id: musicianId.id,
      status: MusicianRequestsStatusFilter.PENDING,
    });

    const output = await useCase.execute(input);

    expect(output.requests).toHaveLength(1);
    expect(output.total_count).toBe(1);
    expect(output.pending_count).toBe(1);
    expect(output.requests[0].status).toBe("pending");
  });

  it("should filter requests by ACCEPTED status", async () => {
    const musicianId = new Uuid();

    const pendingRequest = Request.fake()
      .aRequest()
      .withMusicianId(musicianId)
      .build();
    const acceptedRequest1 = Request.fake()
      .aRequest()
      .withMusicianId(musicianId)
      .build();
    acceptedRequest1.accept();
    const acceptedRequest2 = Request.fake()
      .aRequest()
      .withMusicianId(musicianId)
      .build();
    acceptedRequest2.accept();

    await repository.bulkInsert([
      pendingRequest,
      acceptedRequest1,
      acceptedRequest2,
    ]);

    const input = new GetMusicianRequestsInput({
      musician_id: musicianId.id,
      status: MusicianRequestsStatusFilter.ACCEPTED,
    });

    const output = await useCase.execute(input);

    expect(output.requests).toHaveLength(2);
    expect(output.total_count).toBe(2);
    expect(output.pending_count).toBe(1); // Still counts all pending requests
    output.requests.forEach((request) => {
      expect(request.status).toBe("accepted");
    });
  });

  it("should filter requests by REJECTED status", async () => {
    const musicianId = new Uuid();

    const pendingRequest = Request.fake()
      .aRequest()
      .withMusicianId(musicianId)
      .build();
    const rejectedRequest1 = Request.fake()
      .aRequest()
      .withMusicianId(musicianId)
      .build();
    rejectedRequest1.reject("Busy");
    const rejectedRequest2 = Request.fake()
      .aRequest()
      .withMusicianId(musicianId)
      .build();
    rejectedRequest2.reject("Not my style");

    await repository.bulkInsert([
      pendingRequest,
      rejectedRequest1,
      rejectedRequest2,
    ]);

    const input = new GetMusicianRequestsInput({
      musician_id: musicianId.id,
      status: MusicianRequestsStatusFilter.REJECTED,
    });

    const output = await useCase.execute(input);

    expect(output.requests).toHaveLength(2);
    expect(output.total_count).toBe(2);
    expect(output.pending_count).toBe(1); // Still counts all pending requests
    output.requests.forEach((request) => {
      expect(request.status).toBe("rejected");
    });
  });

  it("should return all requests when status is ALL", async () => {
    const musicianId = new Uuid();

    const pendingRequest = Request.fake()
      .aRequest()
      .withMusicianId(musicianId)
      .build();
    const acceptedRequest = Request.fake()
      .aRequest()
      .withMusicianId(musicianId)
      .build();
    acceptedRequest.accept();
    const rejectedRequest = Request.fake()
      .aRequest()
      .withMusicianId(musicianId)
      .build();
    rejectedRequest.reject("Not available");

    await repository.bulkInsert([
      pendingRequest,
      acceptedRequest,
      rejectedRequest,
    ]);

    const input = new GetMusicianRequestsInput({
      musician_id: musicianId.id,
      status: MusicianRequestsStatusFilter.ALL,
    });

    const output = await useCase.execute(input);

    expect(output.requests).toHaveLength(3);
    expect(output.total_count).toBe(3);
    expect(output.pending_count).toBe(1);

    const statuses = output.requests.map((r) => r.status);
    expect(statuses).toContain("pending");
    expect(statuses).toContain("accepted");
    expect(statuses).toContain("rejected");
  });

  it("should apply limit correctly", async () => {
    const musicianId = new Uuid();
    const requests = Request.fake()
      .theRequests(10)
      .withMusicianId(musicianId)
      .build();
    await repository.bulkInsert(requests);

    const input = new GetMusicianRequestsInput({
      musician_id: musicianId.id,
      limit: 5,
    });

    const output = await useCase.execute(input);

    expect(output.requests).toHaveLength(5);
    expect(output.total_count).toBe(5); // Limited count
    expect(output.pending_count).toBe(10); // Full pending count
  });

  it("should apply per_page correctly", async () => {
    const musicianId = new Uuid();
    const requests = Request.fake()
      .theRequests(20)
      .withMusicianId(musicianId)
      .build();
    await repository.bulkInsert(requests);

    const input = new GetMusicianRequestsInput({
      musician_id: musicianId.id,
      per_page: 8,
    });

    const output = await useCase.execute(input);

    expect(output.requests).toHaveLength(8);
    expect(output.total_count).toBe(20); // Total de itens encontrados
    expect(output.pending_count).toBe(20); // Full pending count
  });

  it("should count pending requests correctly regardless of filter", async () => {
    const musicianId = new Uuid();

    const pendingRequests = Request.fake()
      .theRequests(3)
      .withMusicianId(musicianId)
      .build();
    const acceptedRequest = Request.fake()
      .aRequest()
      .withMusicianId(musicianId)
      .build();
    acceptedRequest.accept();
    const rejectedRequest = Request.fake()
      .aRequest()
      .withMusicianId(musicianId)
      .build();
    rejectedRequest.reject("Not available");

    await repository.bulkInsert([
      ...pendingRequests,
      acceptedRequest,
      rejectedRequest,
    ]);

    // Filter by accepted, but pending count should still be 3
    const input = new GetMusicianRequestsInput({
      musician_id: musicianId.id,
      status: MusicianRequestsStatusFilter.ACCEPTED,
    });

    const output = await useCase.execute(input);

    expect(output.requests).toHaveLength(1);
    expect(output.total_count).toBe(1);
    expect(output.pending_count).toBe(3); // Should count all pending requests
  });

  it("should sort requests by created_at desc", async () => {
    const musicianId = new Uuid();
    const now = new Date();

    const request1 = Request.fake()
      .aRequest()
      .withMusicianId(musicianId)
      .build();
    const request2 = Request.fake()
      .aRequest()
      .withMusicianId(musicianId)
      .build();
    const request3 = Request.fake()
      .aRequest()
      .withMusicianId(musicianId)
      .build();

    // Simulate different creation times
    Object.defineProperty(request1, "created_at", {
      value: new Date(now.getTime() - 3000),
    });
    Object.defineProperty(request2, "created_at", {
      value: new Date(now.getTime() - 1000),
    });
    Object.defineProperty(request3, "created_at", {
      value: new Date(now.getTime() - 2000),
    });

    await repository.bulkInsert([request1, request2, request3]);

    const input = new GetMusicianRequestsInput({
      musician_id: musicianId.id,
    });

    const output = await useCase.execute(input);

    expect(output.requests).toHaveLength(3);
    // Should be sorted by created_at desc (most recent first)
    expect(new Date(output.requests[0].created_at).getTime()).toBeGreaterThan(
      new Date(output.requests[1].created_at).getTime(),
    );
    expect(new Date(output.requests[1].created_at).getTime()).toBeGreaterThan(
      new Date(output.requests[2].created_at).getTime(),
    );
  });
});
