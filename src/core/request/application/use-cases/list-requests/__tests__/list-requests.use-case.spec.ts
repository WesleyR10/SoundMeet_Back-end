import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Request } from "../../../../domain/request.aggregate";
import { RequestInMemoryRepository } from "../../../../infra/db/in-memory/request-in-memory.repository";
import { ListRequestsInput, RequestStatusFilter } from "../list-requests.input";
import { ListRequestsUseCase } from "../list-requests.use-case";

describe("ListRequestsUseCase Unit Tests", () => {
  let useCase: ListRequestsUseCase;
  let repository: RequestInMemoryRepository;

  beforeEach(() => {
    repository = new RequestInMemoryRepository();
    useCase = new ListRequestsUseCase(repository);
  });

  it("should return empty list when no requests exist", async () => {
    const input = new ListRequestsInput({});
    const output = await useCase.execute(input);

    expect(output.items).toHaveLength(0);
    expect(output.total).toBe(0);
    expect(output.current_page).toBe(1);
    expect(output.per_page).toBe(15);
    expect(output.last_page).toBe(0);
  });

  it("should return paginated requests", async () => {
    const requests = Request.fake().theRequests(20).build();
    await repository.bulkInsert(requests);

    const input = new ListRequestsInput({
      page: 1,
      per_page: 10,
    });

    const output = await useCase.execute(input);

    expect(output.items).toHaveLength(10);
    expect(output.total).toBe(20);
    expect(output.current_page).toBe(1);
    expect(output.per_page).toBe(10);
    expect(output.last_page).toBe(2);
  });

  it("should filter requests by audience_id", async () => {
    const audienceId = new Uuid();
    const eventId = new Uuid();
    const requests = [
      Request.fake()
        .aRequest()
        .withEventId(eventId.id)
        .withAudienceId(audienceId.id)
        .build(),
      Request.fake()
        .aRequest()
        .withEventId(eventId.id)
        .withAudienceId(audienceId.id)
        .build(),
      Request.fake().aRequest().build(), // Different audience
    ];
    await repository.bulkInsert(requests);

    const input = new ListRequestsInput({
      filter: { audience_id: audienceId.id },
    });

    const output = await useCase.execute(input);

    expect(output.items).toHaveLength(2);
    expect(output.total).toBe(2);
    output.items.forEach((item) => {
      expect(item.audience_id).toBe(audienceId.id);
    });
  });

  it("should filter requests by musician_id", async () => {
    const musicianId = new Uuid();
    const eventId = new Uuid();
    const requests = [
      Request.fake()
        .aRequest()
        .withEventId(eventId.id)
        .withMusicianId(musicianId.id)
        .build(),
      Request.fake()
        .aRequest()
        .withEventId(eventId.id)
        .withMusicianId(musicianId.id)
        .build(),
      Request.fake().aRequest().build(), // Different musician
    ];
    await repository.bulkInsert(requests);

    const input = new ListRequestsInput({
      filter: { musician_id: musicianId.id },
    });

    const output = await useCase.execute(input);

    expect(output.items).toHaveLength(2);
    expect(output.total).toBe(2);
    output.items.forEach((item) => {
      expect(item.musician_id).toBe(musicianId.id);
    });
  });

  it("should filter requests by status", async () => {
    const pendingRequest = Request.fake().aRequest().build();
    const acceptedRequest = Request.fake().aRequest().build();
    acceptedRequest.accept();
    const rejectedRequest = Request.fake().aRequest().build();
    rejectedRequest.reject("Not available");

    await repository.bulkInsert([
      pendingRequest,
      acceptedRequest,
      rejectedRequest,
    ]);

    const input = new ListRequestsInput({
      filter: { status: RequestStatusFilter.PENDING },
    });

    const output = await useCase.execute(input);

    expect(output.items).toHaveLength(1);
    expect(output.total).toBe(1);
    expect(output.items[0].status).toBe("pending");
  });

  it("should filter requests by song_title", async () => {
    const songTitle = "Bohemian Rhapsody";
    const eventId = new Uuid();
    const requests = [
      Request.fake()
        .aRequest()
        .withEventId(eventId.id)
        .withSongTitle(songTitle)
        .build(),
      Request.fake()
        .aRequest()
        .withEventId(eventId.id)
        .withSongTitle("Another Song")
        .build(),
    ];
    await repository.bulkInsert(requests);

    const input = new ListRequestsInput({
      filter: { song_title: songTitle },
    });

    const output = await useCase.execute(input);

    expect(output.items).toHaveLength(1);
    expect(output.total).toBe(1);
    expect(output.items[0].song_title).toBe(songTitle);
  });

  it("should filter requests by artist", async () => {
    const artist = "Queen";
    const eventId = new Uuid();
    const requests = [
      Request.fake()
        .aRequest()
        .withEventId(eventId.id)
        .withArtist(artist)
        .build(),
      Request.fake()
        .aRequest()
        .withEventId(eventId.id)
        .withArtist("Beatles")
        .build(),
    ];
    await repository.bulkInsert(requests);

    const input = new ListRequestsInput({
      filter: { artist: artist },
    });

    const output = await useCase.execute(input);

    expect(output.items).toHaveLength(1);
    expect(output.total).toBe(1);
    expect(output.items[0].artist).toBe(artist);
  });

  it("should sort requests by created_at desc by default", async () => {
    const now = new Date();
    const request1 = Request.fake().aRequest().build();
    const request2 = Request.fake().aRequest().build();
    const request3 = Request.fake().aRequest().build();

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

    const input = new ListRequestsInput({});
    const output = await useCase.execute(input);

    expect(output.items).toHaveLength(3);
    // Should be sorted by created_at desc (most recent first)
    expect(new Date(output.items[0].created_at).getTime()).toBeGreaterThan(
      new Date(output.items[1].created_at).getTime(),
    );
    expect(new Date(output.items[1].created_at).getTime()).toBeGreaterThan(
      new Date(output.items[2].created_at).getTime(),
    );
  });

  it("should apply multiple filters", async () => {
    const audienceId = new Uuid();
    const musicianId = new Uuid();
    const eventId = new Uuid();
    const songTitle = "Unique Test Song";

    const matchingRequest = Request.fake()
      .aRequest()
      .withEventId(eventId.id)
      .withAudienceId(audienceId.id)
      .withMusicianId(musicianId.id)
      .withSongTitle(songTitle)
      .build();

    const nonMatchingRequests = [
      Request.fake()
        .aRequest()
        .withAudienceId(audienceId.id)
        .withMusicianId(new Uuid().id) // Different musician
        .withSongTitle("Zebra Track") // Completely different song
        .build(),
      Request.fake()
        .aRequest()
        .withAudienceId(new Uuid().id) // Different audience
        .withMusicianId(musicianId.id)
        .withSongTitle("Alpha Music") // Completely different song
        .build(),
      Request.fake()
        .aRequest()
        .withAudienceId(new Uuid().id) // Different audience
        .withMusicianId(new Uuid().id) // Different musician
        .withSongTitle("Different Track") // Completely different song
        .build(),
    ];

    await repository.bulkInsert([matchingRequest, ...nonMatchingRequests]);

    const input = new ListRequestsInput({
      filter: {
        event_id: eventId.id,
        audience_id: audienceId.id,
        musician_id: musicianId.id,
        song_title: songTitle,
      },
    });

    const output = await useCase.execute(input);

    expect(output.items).toHaveLength(1);
    expect(output.total).toBe(1);
    expect(output.items[0].audience_id).toBe(audienceId.id);
    expect(output.items[0].musician_id).toBe(musicianId.id);
    expect(output.items[0].song_title).toBe(songTitle);
  });

  it("should filter requests by event_id", async () => {
    const eventId = new Uuid();
    const otherEventId = new Uuid();

    const requests = [
      Request.fake().aRequest().withEventId(eventId.id).build(),
      Request.fake().aRequest().withEventId(eventId.id).build(),
      Request.fake().aRequest().withEventId(otherEventId.id).build(),
    ];
    await repository.bulkInsert(requests);

    const input = new ListRequestsInput({
      filter: {
        event_id: eventId.id,
      },
    });

    const output = await useCase.execute(input);

    expect(output.items).toHaveLength(2);
    output.items.forEach((item) => {
      expect(item.event_id).toBe(eventId.id);
    });
  });
});
