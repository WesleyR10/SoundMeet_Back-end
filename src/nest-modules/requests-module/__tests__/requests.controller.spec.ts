import { RequestOutput } from "../../../core/request/application/use-cases/common/request-output";
import { GetMusicianRequestsOutput } from "../../../core/request/application/use-cases/get-musician-requests/get-musician-requests.use-case";
import { ListRequestsInput } from "../../../core/request/application/use-cases/list-requests/list-requests.input";
import { ListRequestsOutput } from "../../../core/request/application/use-cases/list-requests/list-requests.use-case";
import { RespondToRequestAction } from "../../../core/request/application/use-cases/respond-to-request/respond-to-request.input";
import { CreateRequestDto } from "../dto/create-request.dto";
import { GetMusicianRequestsDto } from "../dto/get-musician-requests.dto";
import { RespondToRequestDto } from "../dto/respond-to-request.dto";
import { SearchRequestsDto } from "../dto/search-requests.dto";
import { UpdateRequestDto } from "../dto/update-request.dto";
import { VoteRequestDto } from "../dto/vote-request.dto";
import {
  MusicianRequestsPresenter,
  RequestCollectionPresenter,
  RequestPresenter,
} from "../request.presenter";
import { RequestsController } from "../requests.controller";

function makeRequestOutput(
  overrides: Partial<RequestOutput> = {},
): RequestOutput {
  const now = new Date("2025-01-01T00:00:00.000Z");

  return {
    id: "11111111-1111-1111-1111-111111111111",
    event_id: "22222222-2222-2222-2222-222222222222",
    audience_id: "33333333-3333-3333-3333-333333333333",
    musician_id: "44444444-4444-4444-4444-444444444444",
    library_id: null,
    song_title: "Song Title",
    artist: "Artist Name",
    message: "Message",
    status: "pending",
    rejection_reason: null,
    votes_count: 0,
    played_at: null,
    created_at: now,
    updated_at: now,
    responded_at: null,
    is_pending: true,
    is_accepted: false,
    is_played: false,
    is_rejected: false,
    is_responded: false,
    has_message: true,
    display_title: "Song Title - Artist Name",
    age_in_minutes: 0,
    is_recent: true,
    is_old: false,
    is_urgent: false,
    priority: "low",
    points_value: {
      value: 25,
      source: "music_request",
      description: "Music request points",
      metadata: {},
      earnedAt: now,
    },
    is_special_request: false,
    can_be_accepted: true,
    can_be_rejected: true,
    is_within_response_time: true,
    ...overrides,
  };
}

describe("RequestsController Unit Tests", () => {
  let controller: RequestsController;

  beforeEach(() => {
    jest.restoreAllMocks();
    controller = new RequestsController();
  });

  describe("create", () => {
    it("should create a request", async () => {
      const output = makeRequestOutput();
      const mockCreateUseCase = {
        execute: jest.fn().mockResolvedValue(output),
      };
      (controller as any).createUseCase = mockCreateUseCase;

      const serializeSpy = jest.spyOn(RequestsController, "serialize");

      const input: CreateRequestDto = {
        event_id: "22222222-2222-2222-2222-222222222222",
        audience_id: "33333333-3333-3333-3333-333333333333",
        musician_id: "44444444-4444-4444-4444-444444444444",
        song_title: "Song Title",
        artist: "Artist Name",
        message: "Message",
      } as any;

      const presenter = await controller.create(input);

      expect(mockCreateUseCase.execute).toHaveBeenCalledWith(input as any);
      expect(serializeSpy).toHaveBeenCalledWith(output);
      expect(presenter).toBeInstanceOf(RequestPresenter);
      expect(presenter).toStrictEqual(new RequestPresenter(output));
    });

    it("should throw when create use case throws", async () => {
      const error = new Error("create error");
      const mockCreateUseCase = {
        execute: jest.fn().mockRejectedValue(error),
      };
      (controller as any).createUseCase = mockCreateUseCase;

      const input: CreateRequestDto = {
        event_id: "22222222-2222-2222-2222-222222222222",
        audience_id: "33333333-3333-3333-3333-333333333333",
        musician_id: "44444444-4444-4444-4444-444444444444",
        song_title: "Song Title",
      } as any;

      await expect(controller.create(input)).rejects.toThrow(error);
    });
  });

  describe("findAll", () => {
    it("should list requests", async () => {
      const output: ListRequestsOutput = {
        items: [makeRequestOutput()],
        current_page: 1,
        last_page: 1,
        per_page: 2,
        total: 1,
      };

      const mockListUseCase = {
        execute: jest.fn().mockResolvedValue(output),
      };
      (controller as any).listUseCase = mockListUseCase;

      const query: SearchRequestsDto = {
        page: 1,
        per_page: 2,
        sort: "created_at",
        sort_dir: "desc",
        event_id: "event-id",
        audience_id: "audience-id",
        musician_id: "musician-id",
        status: undefined,
        song_title: "Song",
        artist: "Artist",
        created_after: "2025-01-01T00:00:00.000Z",
        created_before: "2025-01-02T00:00:00.000Z",
      } as any;

      const presenter = await controller.findAll(query);

      expect(mockListUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          page: query.page,
          per_page: query.per_page,
          sort: query.sort,
          sort_dir: query.sort_dir,
          event_id: query.event_id,
          audience_id: query.audience_id,
          musician_id: query.musician_id,
          status: query.status,
          song_title: query.song_title,
          artist: query.artist,
          created_after: query.created_after,
          created_before: query.created_before,
        } as Partial<ListRequestsInput>),
      );

      expect(presenter).toBeInstanceOf(RequestCollectionPresenter);
      expect(presenter).toEqual(new RequestCollectionPresenter(output));
    });

    it("should throw when list use case throws", async () => {
      const error = new Error("list error");
      const mockListUseCase = {
        execute: jest.fn().mockRejectedValue(error),
      };
      (controller as any).listUseCase = mockListUseCase;

      const query: SearchRequestsDto = {
        page: 1,
        per_page: 2,
      } as any;

      await expect(controller.findAll(query)).rejects.toThrow(error);
    });
  });

  describe("findOne", () => {
    it("should get a request", async () => {
      const id = "11111111-1111-1111-1111-111111111111";
      const output = makeRequestOutput({ id });
      const mockGetUseCase = {
        execute: jest.fn().mockResolvedValue(output),
      };
      (controller as any).getUseCase = mockGetUseCase;

      const serializeSpy = jest.spyOn(RequestsController, "serialize");

      const presenter = await controller.findOne(id);

      expect(mockGetUseCase.execute).toHaveBeenCalledWith({ id });
      expect(serializeSpy).toHaveBeenCalledWith(output);
      expect(presenter).toBeInstanceOf(RequestPresenter);
      expect(presenter).toStrictEqual(new RequestPresenter(output));
    });

    it("should throw when get use case throws", async () => {
      const error = new Error("get error");
      const mockGetUseCase = {
        execute: jest.fn().mockRejectedValue(error),
      };
      (controller as any).getUseCase = mockGetUseCase;

      const id = "11111111-1111-1111-1111-111111111111";
      await expect(controller.findOne(id)).rejects.toThrow(error);
    });
  });

  describe("update", () => {
    it("should update a request", async () => {
      const id = "11111111-1111-1111-1111-111111111111";
      const output = makeRequestOutput({
        id,
        song_title: "Updated Song",
        artist: "Updated Artist",
        message: "Updated Message",
      });

      const mockUpdateUseCase = {
        execute: jest.fn().mockResolvedValue(output),
      };
      (controller as any).updateUseCase = mockUpdateUseCase;

      const serializeSpy = jest.spyOn(RequestsController, "serialize");

      const input: UpdateRequestDto = {
        song_title: "Updated Song",
        artist: "Updated Artist",
        message: "Updated Message",
      } as any;

      const presenter = await controller.update(id, input);

      expect(mockUpdateUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          id,
          song_title: input.song_title,
          artist: input.artist,
          message: input.message,
        }),
      );
      expect(serializeSpy).toHaveBeenCalledWith(output);
      expect(presenter).toBeInstanceOf(RequestPresenter);
      expect(presenter).toStrictEqual(new RequestPresenter(output));
    });

    it("should throw when update use case throws", async () => {
      const error = new Error("update error");
      const mockUpdateUseCase = {
        execute: jest.fn().mockRejectedValue(error),
      };
      (controller as any).updateUseCase = mockUpdateUseCase;

      const id = "11111111-1111-1111-1111-111111111111";
      const input: UpdateRequestDto = {
        song_title: "Updated Song",
      } as any;

      await expect(controller.update(id, input)).rejects.toThrow(error);
    });
  });

  describe("remove", () => {
    it("should delete a request", async () => {
      const mockDeleteUseCase = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (controller as any).deleteUseCase = mockDeleteUseCase;

      const id = "11111111-1111-1111-1111-111111111111";

      await expect(controller.remove(id)).resolves.toBeUndefined();
      expect(mockDeleteUseCase.execute).toHaveBeenCalledWith({ id });
    });

    it("should throw when delete use case throws", async () => {
      const error = new Error("delete error");
      const mockDeleteUseCase = {
        execute: jest.fn().mockRejectedValue(error),
      };
      (controller as any).deleteUseCase = mockDeleteUseCase;

      const id = "11111111-1111-1111-1111-111111111111";

      await expect(controller.remove(id)).rejects.toThrow(error);
    });
  });

  describe("respond", () => {
    it("should respond to a request", async () => {
      const id = "11111111-1111-1111-1111-111111111111";
      const output = makeRequestOutput({ id, status: "accepted" });

      const mockRespondUseCase = {
        execute: jest.fn().mockResolvedValue(output),
      };
      (controller as any).respondUseCase = mockRespondUseCase;

      const serializeSpy = jest.spyOn(RequestsController, "serialize");

      const input: RespondToRequestDto = {
        musician_id: "44444444-4444-4444-4444-444444444444",
        action: RespondToRequestAction.ACCEPT,
      } as any;

      const presenter = await controller.respond(id, input);

      expect(mockRespondUseCase.execute).toHaveBeenCalledTimes(1);
      const executedInput = mockRespondUseCase.execute.mock
        .calls[0][0] as RespondToRequestDto & {
        request_id: string;
      };

      expect(executedInput.request_id).toBe(id);
      expect(executedInput.musician_id).toBe(input.musician_id);
      expect(executedInput.action).toBe(input.action);

      expect(serializeSpy).toHaveBeenCalledWith(output);
      expect(presenter).toBeInstanceOf(RequestPresenter);
      expect(presenter).toStrictEqual(new RequestPresenter(output));
    });

    it("should throw when respond use case throws", async () => {
      const error = new Error("respond error");
      const mockRespondUseCase = {
        execute: jest.fn().mockRejectedValue(error),
      };
      (controller as any).respondUseCase = mockRespondUseCase;

      const id = "11111111-1111-1111-1111-111111111111";
      const input: RespondToRequestDto = {
        musician_id: "44444444-4444-4444-4444-444444444444",
        action: RespondToRequestAction.REJECT,
        rejection_reason: "Reason",
      } as any;

      await expect(controller.respond(id, input)).rejects.toThrow(error);
    });
  });

  describe("getMusicianRequests", () => {
    it("should list musician requests", async () => {
      const output: GetMusicianRequestsOutput = {
        requests: [makeRequestOutput()],
        total_count: 1,
        pending_count: 1,
      };

      const mockGetMusicianRequestsUseCase = {
        execute: jest.fn().mockResolvedValue(output),
      };
      (controller as any).getMusicianRequestsUseCase =
        mockGetMusicianRequestsUseCase;

      const musician_id = "44444444-4444-4444-4444-444444444444";
      const query: GetMusicianRequestsDto = {
        status: undefined,
        page: 1,
        per_page: 10,
        limit: undefined,
      } as any;

      const presenter = await controller.getMusicianRequests(
        musician_id,
        query,
      );

      expect(mockGetMusicianRequestsUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          musician_id,
          page: query.page,
          per_page: query.per_page,
          limit: query.limit,
          status: query.status ?? "all",
        }),
      );

      expect(presenter).toBeInstanceOf(MusicianRequestsPresenter);
      expect(presenter).toEqual(new MusicianRequestsPresenter(output));
    });

    it("should throw when getMusicianRequests use case throws", async () => {
      const error = new Error("get musician requests error");
      const mockGetMusicianRequestsUseCase = {
        execute: jest.fn().mockRejectedValue(error),
      };
      (controller as any).getMusicianRequestsUseCase =
        mockGetMusicianRequestsUseCase;

      const musician_id = "44444444-4444-4444-4444-444444444444";
      const query: GetMusicianRequestsDto = {
        status: undefined,
        page: 1,
        per_page: 10,
      } as any;

      await expect(
        controller.getMusicianRequests(musician_id, query),
      ).rejects.toThrow(error);
    });
  });

  describe("vote", () => {
    it("should vote on a request", async () => {
      const id = "11111111-1111-1111-1111-111111111111";
      const output = makeRequestOutput({ id, votes_count: 1 });
      const mockVoteUseCase = {
        execute: jest.fn().mockResolvedValue(output),
      };
      (controller as any).voteRequestUseCase = mockVoteUseCase;

      const serializeSpy = jest.spyOn(RequestsController, "serialize");
      const input: VoteRequestDto = {
        audience_id: "33333333-3333-3333-3333-333333333333",
        vote_type: "up" as any,
      };

      const presenter = await controller.vote(id, input);

      expect(mockVoteUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          request_id: id,
          audience_id: input.audience_id,
          vote_type: input.vote_type,
        }),
      );
      expect(serializeSpy).toHaveBeenCalledWith(output);
      expect(presenter).toBeInstanceOf(RequestPresenter);
      expect(presenter).toStrictEqual(new RequestPresenter(output));
    });

    it("should throw when vote use case throws", async () => {
      const error = new Error("vote error");
      const mockVoteUseCase = {
        execute: jest.fn().mockRejectedValue(error),
      };
      (controller as any).voteRequestUseCase = mockVoteUseCase;

      await expect(
        controller.vote("11111111-1111-1111-1111-111111111111", {
          audience_id: "33333333-3333-3333-3333-333333333333",
          vote_type: "down" as any,
        }),
      ).rejects.toThrow(error);
    });
  });

  describe("serialize", () => {
    it("should serialize output into presenter", () => {
      const output = makeRequestOutput();
      const presenter = RequestsController.serialize(output);
      expect(presenter).toBeInstanceOf(RequestPresenter);
      expect(presenter).toStrictEqual(new RequestPresenter(output));
    });
  });
});
