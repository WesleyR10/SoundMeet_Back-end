import { Test, TestingModule } from "@nestjs/testing";

import { Audience, AudienceId } from "../../../core/audience/domain";
import { AudienceInMemoryRepository } from "../../../core/audience/infra/db/in-memory/audience-in-memory.repository";
import { Event, EventId } from "../../../core/events/domain";
import { EventInMemoryRepository } from "../../../core/events/infra/db/in-memory/event-in-memory.repository";
import {
  Musician,
  MusicianId,
} from "../../../core/musician/domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../core/musician/infra/db/in-memory/musician-in-memory.repository";
import { RequestOutputMapper } from "../../../core/request/application/use-cases/common/request-output";
import { CreateRequestUseCase } from "../../../core/request/application/use-cases/create-request/create-request.use-case";
import { CreateRequestFeedbackUseCase } from "../../../core/request/application/use-cases/create-request-feedback/create-request-feedback.use-case";
import { DeleteRequestUseCase } from "../../../core/request/application/use-cases/delete-request/delete-request.use-case";
import { GetMusicianRequestsUseCase } from "../../../core/request/application/use-cases/get-musician-requests/get-musician-requests.use-case";
import { GetRequestUseCase } from "../../../core/request/application/use-cases/get-request/get-request.use-case";
import { GetRequestFeedbackUseCase } from "../../../core/request/application/use-cases/get-request-feedback/get-request-feedback.use-case";
import { GetRequestSuggestionsUseCase } from "../../../core/request/application/use-cases/get-request-suggestions/get-request-suggestions.use-case";
import { ListRequestsUseCase } from "../../../core/request/application/use-cases/list-requests/list-requests.use-case";
import { MarkRequestPlayedUseCase } from "../../../core/request/application/use-cases/mark-request-played/mark-request-played.use-case";
import { BatchRespondToRequestsUseCase } from "../../../core/request/application/use-cases/batch-respond-to-requests/batch-respond-to-requests.use-case";
import { RespondToRequestAction } from "../../../core/request/application/use-cases/respond-to-request/respond-to-request.input";
import { RespondToRequestUseCase } from "../../../core/request/application/use-cases/respond-to-request/respond-to-request.use-case";
import { UpdateRequestUseCase } from "../../../core/request/application/use-cases/update-request/update-request.use-case";
import { VoteRequestUseCase } from "../../../core/request/application/use-cases/vote-request/vote-request.use-case";
import {
  Request,
  RequestId,
} from "../../../core/request/domain/request.aggregate";
import { IRequestRepository } from "../../../core/request/domain/request.repository";
import { IRequestVoteRepository } from "../../../core/request/domain/request-vote.repository";
import { RequestFeedbackInMemoryRepository } from "../../../core/request/infra/db/in-memory/request-feedback-in-memory.repository";
import { RequestInMemoryRepository } from "../../../core/request/infra/db/in-memory/request-in-memory.repository";
import { RequestVoteInMemoryRepository } from "../../../core/request/infra/db/in-memory/request-vote-in-memory.repository";
import { Uuid } from "../../../core/shared/domain/value-objects/uuid.vo";
import { applyAuthGuardMocks } from "../../shared-module/testing/auth-guard-mock";
import {
  MusicianRequestsPresenter,
  RequestCollectionPresenter,
  RequestPresenter,
} from "../request.presenter";
import { RequestsController } from "../requests.controller";

describe("RequestsController Integration Tests", () => {
  let controller: RequestsController;
  let repository: IRequestRepository;
  let eventRepository: EventInMemoryRepository;
  let musicianRepository: MusicianInMemoryRepository;
  let audienceRepository: AudienceInMemoryRepository;

  const setupEventWithMusicians = async (
    eventId: string,
    musicianIds: string[],
  ) => {
    const now = new Date();
    const event = new Event({
      event_id: new EventId(eventId),
      establishment_id: new Uuid(),
      name: "Event",
      start_at: now,
      end_at: new Date(now.getTime() + 60 * 60 * 1000),
      status: "active",
    });
    await eventRepository.insert(event);

    for (const musicianId of musicianIds) {
      const musician = Musician.create({
        musician_id: new MusicianId(musicianId),
        email: `${musicianId}@soundmeet.test`,
        name: `Musician ${musicianId}`,
        genres: ["rock"],
        instruments: ["guitar"],
      });
      await musicianRepository.insert(musician);
      await eventRepository.addPerformer(new EventId(eventId), {
        musician_id: musicianId,
      });
    }
  };

  const setupAudienceInEvent = async (eventId: string, audienceId: string) => {
    await audienceRepository.insert(
      new Audience({
        audience_id: new AudienceId(audienceId),
        email: `${audienceId}@soundmeet.test`,
        name: "Audience",
        is_active: true,
      }),
    );
    await eventRepository.addAttendee(new EventId(eventId), audienceId);
  };

  beforeEach(async () => {
    const repositoryInstance = new RequestInMemoryRepository();
    const requestVoteRepositoryInstance = new RequestVoteInMemoryRepository();
    const requestFeedbackRepositoryInstance =
      new RequestFeedbackInMemoryRepository();
    eventRepository = new EventInMemoryRepository();
    musicianRepository = new MusicianInMemoryRepository();
    audienceRepository = new AudienceInMemoryRepository();

    const moduleBuilder = Test.createTestingModule({
      controllers: [RequestsController],
      providers: [
        {
          provide: "RequestRepository",
          useValue: repositoryInstance,
        },
        {
          provide: "RequestVoteRepository",
          useValue: requestVoteRepositoryInstance,
        },
        {
          provide: "EventRepository",
          useValue: eventRepository,
        },
        {
          provide: "MusicianRepository",
          useValue: musicianRepository,
        },
        {
          provide: "AudienceRepository",
          useValue: audienceRepository,
        },
        {
          provide: CreateRequestUseCase,
          useFactory: (
            repo: IRequestRepository,
            eventRepo: EventInMemoryRepository,
            musicianRepo: MusicianInMemoryRepository,
            audRepo: AudienceInMemoryRepository,
          ) =>
            new CreateRequestUseCase(
              repo,
              eventRepo,
              musicianRepo,
              audRepo,
              10,
              120,
            ),
          inject: [
            "RequestRepository",
            "EventRepository",
            "MusicianRepository",
            "AudienceRepository",
          ],
        },
        {
          provide: ListRequestsUseCase,
          useFactory: (repo: IRequestRepository) =>
            new ListRequestsUseCase(repo),
          inject: ["RequestRepository"],
        },
        {
          provide: GetRequestUseCase,
          useFactory: (
            repo: IRequestRepository,
            eventRepo: EventInMemoryRepository,
          ) => new GetRequestUseCase(repo, eventRepo),
          inject: ["RequestRepository", "EventRepository"],
        },
        {
          provide: UpdateRequestUseCase,
          useFactory: (
            repo: IRequestRepository,
            eventRepo: EventInMemoryRepository,
            musicianRepo: MusicianInMemoryRepository,
          ) => new UpdateRequestUseCase(repo, eventRepo, musicianRepo),
          inject: [
            "RequestRepository",
            "EventRepository",
            "MusicianRepository",
          ],
        },
        {
          provide: DeleteRequestUseCase,
          useFactory: (repo: IRequestRepository) =>
            new DeleteRequestUseCase(repo),
          inject: ["RequestRepository"],
        },
        {
          provide: BatchRespondToRequestsUseCase,
          useFactory: (respondUseCase: RespondToRequestUseCase) =>
            new BatchRespondToRequestsUseCase(respondUseCase),
          inject: [RespondToRequestUseCase],
        },
        {
          provide: RespondToRequestUseCase,
          useFactory: (
            repo: IRequestRepository,
            eventRepo: EventInMemoryRepository,
            musicianRepo: MusicianInMemoryRepository,
          ) => new RespondToRequestUseCase(repo, eventRepo, musicianRepo, 60),
          inject: [
            "RequestRepository",
            "EventRepository",
            "MusicianRepository",
          ],
        },
        {
          provide: GetMusicianRequestsUseCase,
          useFactory: (repo: IRequestRepository) =>
            new GetMusicianRequestsUseCase(repo),
          inject: ["RequestRepository"],
        },
        {
          provide: GetRequestSuggestionsUseCase,
          useFactory: (
            repo: IRequestRepository,
            musicianRepo: MusicianInMemoryRepository,
          ) => new GetRequestSuggestionsUseCase(repo, musicianRepo),
          inject: ["RequestRepository", "MusicianRepository"],
        },
        {
          provide: MarkRequestPlayedUseCase,
          useFactory: (
            repo: IRequestRepository,
            eventRepo: EventInMemoryRepository,
            musicianRepo: MusicianInMemoryRepository,
          ) => new MarkRequestPlayedUseCase(repo, eventRepo, musicianRepo),
          inject: [
            "RequestRepository",
            "EventRepository",
            "MusicianRepository",
          ],
        },
        {
          provide: VoteRequestUseCase,
          useFactory: (
            repo: IRequestRepository,
            voteRepo: IRequestVoteRepository,
          ) => new VoteRequestUseCase(repo, voteRepo),
          inject: ["RequestRepository", "RequestVoteRepository"],
        },
        {
          provide: CreateRequestFeedbackUseCase,
          useValue: new CreateRequestFeedbackUseCase(
            requestFeedbackRepositoryInstance,
            repositoryInstance,
          ),
        },
        {
          provide: GetRequestFeedbackUseCase,
          useValue: new GetRequestFeedbackUseCase(
            requestFeedbackRepositoryInstance,
            repositoryInstance,
            eventRepository,
          ),
        },
      ],
    });

    const module: TestingModule =
      await applyAuthGuardMocks(moduleBuilder).compile();

    controller = module.get<RequestsController>(RequestsController);
    repository = module.get<IRequestRepository>("RequestRepository");
  });
  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(controller["createUseCase"]).toBeInstanceOf(CreateRequestUseCase);
    expect(controller["listUseCase"]).toBeInstanceOf(ListRequestsUseCase);
    expect(controller["getUseCase"]).toBeInstanceOf(GetRequestUseCase);
    expect(controller["updateUseCase"]).toBeInstanceOf(UpdateRequestUseCase);
    expect(controller["deleteUseCase"]).toBeInstanceOf(DeleteRequestUseCase);
    expect(controller["respondUseCase"]).toBeInstanceOf(
      RespondToRequestUseCase,
    );
    expect(controller["getMusicianRequestsUseCase"]).toBeInstanceOf(
      GetMusicianRequestsUseCase,
    );
  });

  it("should create a request", async () => {
    const eventId = new Uuid().id;
    const audienceId = new Uuid().id;
    const musicianId = new Uuid().id;

    await setupEventWithMusicians(eventId, [musicianId]);
    await setupAudienceInEvent(eventId, audienceId);

    const presenter = await controller.create(
      {
        event_id: eventId,
        musician_id: musicianId,
        song_title: "Song Title",
        artist: "Artist",
        message: "Message",
      } as any,
      {
        userId: audienceId,
        roles: ["audience"],
        establishmentIds: [],
        bandIds: [],
        isAdmin: false,
      },
    );

    const entity = await repository.findById(new RequestId(presenter.id));

    expect(entity).toBeInstanceOf(Request);
    expect(presenter).toBeInstanceOf(RequestPresenter);

    const output = RequestOutputMapper.toOutput(entity!);
    const expectedPresenter = new RequestPresenter(output);

    expect(presenter.id).toBe(expectedPresenter.id);
    expect(presenter.event_id).toBe(expectedPresenter.event_id);
    expect(presenter.audience_id).toBe(expectedPresenter.audience_id);
    expect(presenter.musician_id).toBe(expectedPresenter.musician_id);
    expect(presenter.song_title).toBe(expectedPresenter.song_title);
    expect(presenter.artist).toBe(expectedPresenter.artist);
    expect(presenter.message).toBe(expectedPresenter.message);
    expect(presenter.status).toBe(expectedPresenter.status);
    expect(presenter.points_value.value).toBe(
      expectedPresenter.points_value.value,
    );
  });

  it("should get a request", async () => {
    const eventId = new Uuid().id;
    const audienceId = new Uuid().id;
    const musicianId = new Uuid().id;

    await setupEventWithMusicians(eventId, [musicianId]);
    await setupAudienceInEvent(eventId, audienceId);

    const presenter = await controller.create(
      {
        event_id: eventId,
        musician_id: musicianId,
        song_title: "Song Title",
      } as any,
      {
        userId: audienceId,
        roles: ["audience"],
        establishmentIds: [],
        bandIds: [],
        isAdmin: false,
      },
    );

    const fetched = await controller.findOne(presenter.id);

    expect(fetched).toBeInstanceOf(RequestPresenter);
    expect(fetched.id).toBe(presenter.id);
  });

  it("should list requests with pagination", async () => {
    for (let i = 0; i < 3; i++) {
      const eventId = new Uuid().id;
      const audienceId = new Uuid().id;
      const musicianId = new Uuid().id;
      await setupEventWithMusicians(eventId, [musicianId]);
      await setupAudienceInEvent(eventId, audienceId);
      await controller.create(
        {
          event_id: eventId,
          musician_id: musicianId,
          song_title: `Song ${i}`,
        } as any,
        {
          userId: audienceId,
          roles: ["audience"],
          establishmentIds: [],
          bandIds: [],
          isAdmin: false,
        },
      );
    }

    const presenter = await controller.findAll({
      page: 1,
      per_page: 2,
    } as any);

    expect(presenter).toBeInstanceOf(RequestCollectionPresenter);
    expect(presenter.data.length).toBe(2);
  });

  it("should update a request", async () => {
    const eventId = new Uuid().id;
    const audienceId = new Uuid().id;
    const musicianId = new Uuid().id;

    await setupEventWithMusicians(eventId, [musicianId]);
    await setupAudienceInEvent(eventId, audienceId);

    const created = await controller.create(
      {
        event_id: eventId,
        musician_id: musicianId,
        song_title: "Original Song",
        artist: "Original Artist",
      } as any,
      {
        userId: audienceId,
        roles: ["audience"],
        establishmentIds: [],
        bandIds: [],
        isAdmin: false,
      },
    );

    const updated = await controller.update(created.id, {
      song_title: "Updated Song",
      artist: "Updated Artist",
      message: "Updated Message",
    } as any);

    const entity = await repository.findById(new RequestId(created.id));

    expect(entity!.song_title.value).toBe("Updated Song");
    expect(entity!.artist).toBe("Updated Artist");
    expect(entity!.message?.value).toBe("Updated Message");
    expect(updated).toBeInstanceOf(RequestPresenter);
  });

  it("should respond to a request", async () => {
    const eventId = new Uuid().id;
    const audienceId = new Uuid().id;
    const musicianId = new Uuid().id;

    await setupEventWithMusicians(eventId, [musicianId]);
    await setupAudienceInEvent(eventId, audienceId);

    const created = await controller.create(
      {
        event_id: eventId,
        musician_id: musicianId,
        song_title: "Song Title",
      } as any,
      {
        userId: audienceId,
        roles: ["audience"],
        establishmentIds: [],
        bandIds: [],
        isAdmin: false,
      },
    );

    const responded = await controller.respond(
      created.id,
      { action: RespondToRequestAction.ACCEPT } as any,
      {
        userId: musicianId,
        roles: ["musician"],
        establishmentIds: [],
        bandIds: [],
        isAdmin: false,
      },
    );

    const entity = await repository.findById(new RequestId(created.id));

    expect(entity!.isAccepted).toBe(true);
    expect(responded.status).toBe("accepted");
  });

  it("should list musician requests and pending count", async () => {
    const musicianId = new Uuid().id;
    const firstEventId = new Uuid().id;
    const secondEventId = new Uuid().id;
    const firstAudienceId = new Uuid().id;
    const secondAudienceId = new Uuid().id;

    await setupEventWithMusicians(firstEventId, [musicianId]);
    await setupEventWithMusicians(secondEventId, [musicianId]);
    await setupAudienceInEvent(firstEventId, firstAudienceId);
    await setupAudienceInEvent(secondEventId, secondAudienceId);

    await controller.create(
      {
        event_id: firstEventId,
        musician_id: musicianId,
        song_title: "Song 1",
      } as any,
      {
        userId: firstAudienceId,
        roles: ["audience"],
        establishmentIds: [],
        bandIds: [],
        isAdmin: false,
      },
    );

    await controller.create(
      {
        event_id: secondEventId,
        musician_id: musicianId,
        song_title: "Song 2",
      } as any,
      {
        userId: secondAudienceId,
        roles: ["audience"],
        establishmentIds: [],
        bandIds: [],
        isAdmin: false,
      },
    );

    const presenter = await controller.getMusicianRequests(musicianId, {
      status: undefined,
      page: 1,
      per_page: 10,
    } as any);

    expect(presenter).toBeInstanceOf(MusicianRequestsPresenter);
    expect(presenter.requests.length).toBe(2);
    expect(presenter.total_count).toBe(2);
    expect(presenter.pending_count).toBe(2);
  });

  it("should let an audience list their own requests", async () => {
    const musicianId = new Uuid().id;
    const eventId = new Uuid().id;
    const audienceId = new Uuid().id;
    const otherAudienceId = new Uuid().id;

    await setupEventWithMusicians(eventId, [musicianId]);
    await setupAudienceInEvent(eventId, audienceId);
    await setupAudienceInEvent(eventId, otherAudienceId);

    await controller.create(
      {
        event_id: eventId,
        musician_id: musicianId,
        song_title: "Song 1",
      } as any,
      {
        userId: audienceId,
        roles: ["audience"],
        establishmentIds: [],
        bandIds: [],
        isAdmin: false,
      },
    );
    await controller.create(
      {
        event_id: eventId,
        musician_id: musicianId,
        song_title: "Song 2",
      } as any,
      {
        userId: otherAudienceId,
        roles: ["audience"],
        establishmentIds: [],
        bandIds: [],
        isAdmin: false,
      },
    );

    const presenter = await controller.getAudienceRequests(
      audienceId,
      { page: 1, per_page: 10 } as any,
      {
        userId: audienceId,
        roles: ["audience"],
        establishmentIds: [],
        bandIds: [],
        isAdmin: false,
      },
    );

    expect(presenter).toBeInstanceOf(RequestCollectionPresenter);
    expect(presenter.data.length).toBe(1);
    expect(presenter.data[0].song_title).toBe("Song 1");
  });

  it("should forbid an audience from listing another audience's requests", async () => {
    const audienceId = new Uuid().id;
    const otherAudienceId = new Uuid().id;

    await expect(
      controller.getAudienceRequests(
        otherAudienceId,
        { page: 1, per_page: 10 } as any,
        {
          userId: audienceId,
          roles: ["audience"],
          establishmentIds: [],
          bandIds: [],
          isAdmin: false,
        },
      ),
    ).rejects.toThrow("Você não tem permissão para ver pedidos de outro fã.");
  });

  it("should let an admin list any audience's requests", async () => {
    const musicianId = new Uuid().id;
    const eventId = new Uuid().id;
    const audienceId = new Uuid().id;

    await setupEventWithMusicians(eventId, [musicianId]);
    await setupAudienceInEvent(eventId, audienceId);

    await controller.create(
      {
        event_id: eventId,
        musician_id: musicianId,
        song_title: "Song 1",
      } as any,
      {
        userId: audienceId,
        roles: ["audience"],
        establishmentIds: [],
        bandIds: [],
        isAdmin: false,
      },
    );

    const presenter = await controller.getAudienceRequests(
      audienceId,
      { page: 1, per_page: 10 } as any,
      {
        userId: new Uuid().id,
        roles: ["admin"],
        establishmentIds: [],
        bandIds: [],
        isAdmin: true,
      },
    );

    expect(presenter.data.length).toBe(1);
  });

  it("should delete a request", async () => {
    const eventId = new Uuid().id;
    const audienceId = new Uuid().id;
    const musicianId = new Uuid().id;

    await setupEventWithMusicians(eventId, [musicianId]);
    await setupAudienceInEvent(eventId, audienceId);

    const created = await controller.create(
      {
        event_id: eventId,
        musician_id: musicianId,
        song_title: "Song Title",
      } as any,
      {
        userId: audienceId,
        roles: ["audience"],
        establishmentIds: [],
        bandIds: [],
        isAdmin: false,
      },
    );

    const response = await controller.remove(created.id);

    expect(response).not.toBeDefined();
    await expect(
      repository.findById(new RequestId(created.id)),
    ).resolves.toBeNull();
  });
});
