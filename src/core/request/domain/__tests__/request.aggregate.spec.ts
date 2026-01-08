import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { Request, RequestCreateCommand } from "../request.aggregate";
import { RequestMessage } from "../value-objects/request-message.vo";
import {
  RequestStatus,
  RequestStatusEnum,
} from "../value-objects/request-status.vo";
import { SongTitle } from "../value-objects/song-title.vo";

describe("Request Unit Tests", () => {
  describe("constructor", () => {
    test("should create a request with valid data", () => {
      const props = {
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
        artist: "Queen",
        message: "Please play this song!",
      };

      const request = new Request(props);

      expect(request.audience_id).toBeInstanceOf(Uuid);
      expect(request.musician_id).toBeInstanceOf(Uuid);
      expect(request.song_title).toBeInstanceOf(SongTitle);
      expect(request.artist).toBe("Queen");
      expect(request.message).toBeInstanceOf(RequestMessage);
      expect(request.status).toBeInstanceOf(RequestStatus);
      expect(request.status.isPending()).toBe(true);
      expect(request.rejection_reason).toBeNull();
      expect(request.responded_at).toBeNull();
      expect(request.created_at).toBeInstanceOf(Date);
    });

    test("should create a request with minimal data", () => {
      const props = {
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
      };

      const request = new Request(props);

      expect(request.artist).toBeNull();
      expect(request.message).toBeNull();
      expect(request.status.isPending()).toBe(true);
    });

    test("should create a request with custom status", () => {
      const props = {
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
        status: RequestStatusEnum.ACCEPTED,
      };

      const request = new Request(props);

      expect(request.status.isAccepted()).toBe(true);
    });
  });

  describe("create", () => {
    test("should create a request using static method", () => {
      const command: RequestCreateCommand = {
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
        artist: "Queen",
        message: "Please play this song!",
      };

      const request = Request.create(command);

      expect(request).toBeInstanceOf(Request);
      expect(request.status.isPending()).toBe(true);
    });

    test("should throw error when creating with invalid data", () => {
      const command: RequestCreateCommand = {
        audience_id: "invalid-uuid",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
      };

      expect(() => Request.create(command)).toThrow();
    });
  });

  describe("accept", () => {
    test("should accept a pending request", () => {
      const request = Request.create({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
      });

      request.accept();

      expect(request.status.isAccepted()).toBe(true);
      expect(request.responded_at).toBeInstanceOf(Date);
      expect(request.rejection_reason).toBeNull();
    });

    test("should add error when accepting non-pending request", () => {
      const request = Request.create({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
      });

      request.accept();

      request.accept();
      expect(request.notification.hasErrors()).toBe(true);
    });
  });

  describe("reject", () => {
    test("should reject a pending request", () => {
      const request = Request.create({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
      });

      const reason = "Not in my repertoire";
      request.reject(reason);

      expect(request.status.isRejected()).toBe(true);
      expect(request.responded_at).toBeInstanceOf(Date);
      expect(request.rejection_reason).toBe(reason);
    });

    test("should reject without reason", () => {
      const request = Request.create({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
      });

      request.reject();

      expect(request.status.isRejected()).toBe(true);
      expect(request.rejection_reason).toBeNull();
    });

    test("should add error when rejecting non-pending request", () => {
      const request = Request.create({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
      });

      request.reject();

      request.reject();
      expect(request.notification.hasErrors()).toBe(true);
    });
  });

  describe("change methods", () => {
    test("should change song title of pending request", () => {
      const request = Request.create({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
      });

      request.changeSongTitle("We Will Rock You");

      expect(request.song_title.value).toBe("We Will Rock You");
    });

    test("should add error when changing song title of non-pending request", () => {
      const request = Request.create({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
      });

      request.accept();
      request.changeSongTitle("We Will Rock You");

      expect(request.notification.hasErrors()).toBe(true);
      const errors = request.notification.toJSON();
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            song_title: expect.arrayContaining([
              "Cannot change song title of non-pending request",
            ]),
          }),
        ]),
      );
    });

    test("should change artist of pending request", () => {
      const request = Request.create({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
      });

      request.changeArtist("Queen");

      expect(request.artist).toBe("Queen");
    });

    test("should change message of pending request", () => {
      const request = Request.create({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
      });

      request.changeMessage("Please play this amazing song!");

      expect(request.message?.value).toBe("Please play this amazing song!");
    });
  });

  describe("getters", () => {
    test("should return correct status checks", () => {
      const request = Request.create({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
      });

      expect(request.isPending).toBe(true);
      expect(request.isAccepted).toBe(false);
      expect(request.isRejected).toBe(false);
      expect(request.isResponded).toBe(false);

      request.accept();

      expect(request.isPending).toBe(false);
      expect(request.isAccepted).toBe(true);
      expect(request.isRejected).toBe(false);
      expect(request.isResponded).toBe(true);
    });

    test("should return correct display title", () => {
      const requestWithArtist = Request.create({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
        artist: "Queen",
      });

      const requestWithoutArtist = Request.create({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
      });

      expect(requestWithArtist.displayTitle).toBe("Bohemian Rhapsody - Queen");
      expect(requestWithoutArtist.displayTitle).toBe("Bohemian Rhapsody");
    });

    test("should calculate points value correctly", () => {
      const pendingRequest = Request.create({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
      });

      const acceptedRequest = Request.create({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
      });
      acceptedRequest.accept();

      expect(pendingRequest.pointsValue.value).toBe(25); // Base points only
      expect(acceptedRequest.pointsValue.value).toBe(75); // Base + accepted bonus
    });
  });

  describe("toJSON", () => {
    test("should return correct JSON representation", () => {
      const request = Request.create({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        song_title: "Bohemian Rhapsody",
        artist: "Queen",
        message: "Please play this song!",
      });

      const json = request.toJSON();

      expect(json).toMatchObject({
        request_id: request.request_id.id,
        audience_id: request.audience_id.id,
        musician_id: request.musician_id.id,
        song_title: request.song_title.value,
        artist: "Queen",
        message: "Please play this song!",
        status: "pending",
        rejection_reason: null,
        created_at: request.created_at,
        responded_at: null,
      });
    });
  });

  describe("fake", () => {
    test("should create fake request", () => {
      const fakeRequest = Request.fake().aRequest().build();

      expect(fakeRequest).toBeInstanceOf(Request);
      expect(fakeRequest.request_id).toBeDefined();
      expect(fakeRequest.audience_id).toBeDefined();
      expect(fakeRequest.musician_id).toBeDefined();
      expect(fakeRequest.song_title).toBeDefined();
    });
  });
});
