import { UserInteraction } from "../../../../domain/user-interaction.aggregate";
import {
  UserInteractionModelMapper,
  UserInteractionModelProps,
} from "../user-interaction-model-mapper";

describe("UserInteractionModelMapper", () => {
  describe("toModel", () => {
    it("should convert entity to model with all properties", () => {
      const userInteraction = UserInteraction.fake()
        .aUserInteraction()
        .withInteractionType("social_share")
        .withPointsEarned(10)
        .withMetadata({ platform: "instagram", content_type: "story" })
        .build();

      const model = UserInteractionModelMapper.toModel(userInteraction);

      expect(model).toEqual({
        id: userInteraction.user_interaction_id.id,
        audienceId: userInteraction.user_id.id,
        type: userInteraction.interaction_type,
        musicianId: userInteraction.target_id,
        metadata: userInteraction.metadata,
        points: userInteraction.points_earned,
        created_at: userInteraction.created_at,
      });
    });

    it("should convert entity to model with null metadata", () => {
      const userInteraction = UserInteraction.fake()
        .aUserInteraction()
        .withInteractionType("follow")
        .withPointsEarned(5)
        .build();

      // Remove metadata to test null case
      userInteraction.changeMetadata(undefined);

      const model = UserInteractionModelMapper.toModel(userInteraction);

      expect(model).toEqual({
        id: userInteraction.user_interaction_id.id,
        audienceId: userInteraction.user_id.id,
        type: userInteraction.interaction_type,
        musicianId: userInteraction.target_id,
        metadata: null,
        points: userInteraction.points_earned,
        created_at: userInteraction.created_at,
      });
    });
  });

  describe("toEntity", () => {
    it("should convert model to entity with all properties", () => {
      const model: UserInteractionModelProps = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        audienceId: "123e4567-e89b-12d3-a456-426614174001",
        type: "music_request",
        musicianId: "123e4567-e89b-12d3-a456-426614174002",
        metadata: {
          song_title: "Great performance!",
          artist_name: "Local Band",
          message: "Could you play this song?",
        },
        points: 15,
        created_at: new Date("2024-01-01T00:00:00.000Z"),
      };

      const entity = UserInteractionModelMapper.toEntity(model);

      expect(entity.user_interaction_id.id).toBe(model.id);
      expect(entity.user_id.id).toBe(model.audienceId);
      expect(entity.interaction_type).toBe(model.type);
      expect(entity.target_id).toBe(model.musicianId);
      expect(entity.metadata).toEqual(model.metadata);
      expect(entity.points_earned).toBe(model.points);
      expect(entity.created_at).toEqual(model.created_at);
    });

    it("should convert model to entity with null metadata", () => {
      const model: UserInteractionModelProps = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        audienceId: "123e4567-e89b-12d3-a456-426614174001",
        type: "share",
        musicianId: "123e4567-e89b-12d3-a456-426614174002",
        metadata: undefined, // Use undefined instead of null for optional field
        points: 8,
        created_at: new Date("2024-01-01T00:00:00.000Z"),
      };

      const entity = UserInteractionModelMapper.toEntity(model);

      expect(entity.user_interaction_id.id).toBe(model.id);
      expect(entity.user_id.id).toBe(model.audienceId);
      expect(entity.interaction_type).toBe(model.type);
      expect(entity.target_id).toBe(model.musicianId);
      expect(entity.metadata).toBeNull();
      expect(entity.points_earned).toBe(model.points);
      expect(entity.created_at).toEqual(model.created_at);
    });
  });

  describe("bidirectional conversion", () => {
    it("should maintain data integrity in both directions with metadata", () => {
      const originalUserInteraction = UserInteraction.fake()
        .aUserInteraction()
        .withInteractionType("qr_scan")
        .withPointsEarned(3)
        .withMetadata({
          location: "Main Stage",
          timestamp: "2024-01-01T12:00:00Z",
        })
        .build();

      const model = UserInteractionModelMapper.toModel(originalUserInteraction);
      const convertedUserInteraction =
        UserInteractionModelMapper.toEntity(model);

      expect(convertedUserInteraction.user_interaction_id.id).toBe(
        originalUserInteraction.user_interaction_id.id,
      );
      expect(convertedUserInteraction.user_id.id).toBe(
        originalUserInteraction.user_id.id,
      );
      expect(convertedUserInteraction.interaction_type).toBe(
        originalUserInteraction.interaction_type,
      );
      expect(convertedUserInteraction.target_id).toBe(
        originalUserInteraction.target_id,
      );
      expect(convertedUserInteraction.metadata).toEqual(
        originalUserInteraction.metadata,
      );
      expect(convertedUserInteraction.points_earned).toBe(
        originalUserInteraction.points_earned,
      );
      expect(convertedUserInteraction.created_at).toEqual(
        originalUserInteraction.created_at,
      );
    });

    it("should maintain data integrity in both directions with null metadata", () => {
      const originalUserInteraction = UserInteraction.fake()
        .aUserInteraction()
        .withInteractionType("view")
        .withPointsEarned(1)
        .build();

      // Ensure metadata is null
      originalUserInteraction.changeMetadata(null);

      const model = UserInteractionModelMapper.toModel(originalUserInteraction);
      const convertedUserInteraction =
        UserInteractionModelMapper.toEntity(model);

      expect(convertedUserInteraction.user_interaction_id.id).toBe(
        originalUserInteraction.user_interaction_id.id,
      );
      expect(convertedUserInteraction.user_id.id).toBe(
        originalUserInteraction.user_id.id,
      );
      expect(convertedUserInteraction.interaction_type).toBe(
        originalUserInteraction.interaction_type,
      );
      expect(convertedUserInteraction.target_id).toBe(
        originalUserInteraction.target_id,
      );
      expect(convertedUserInteraction.metadata).toBeNull();
      expect(convertedUserInteraction.points_earned).toBe(
        originalUserInteraction.points_earned,
      );
      expect(convertedUserInteraction.created_at).toEqual(
        originalUserInteraction.created_at,
      );
    });

    it("should handle null target_id correctly", () => {
      const originalUserInteraction = UserInteraction.fake()
        .aUserInteraction()
        .withInteractionType("scan_qr")
        .withPointsEarned(2)
        .build();

      // Set target_id to null
      originalUserInteraction.changeTargetId(null);

      const model = UserInteractionModelMapper.toModel(originalUserInteraction);
      const convertedUserInteraction =
        UserInteractionModelMapper.toEntity(model);

      expect(convertedUserInteraction.user_interaction_id.id).toBe(
        originalUserInteraction.user_interaction_id.id,
      );
      expect(convertedUserInteraction.user_id.id).toBe(
        originalUserInteraction.user_id.id,
      );
      expect(convertedUserInteraction.interaction_type).toBe(
        originalUserInteraction.interaction_type,
      );
      expect(convertedUserInteraction.target_id).toBeNull();
      expect(convertedUserInteraction.points_earned).toBe(
        originalUserInteraction.points_earned,
      );
      expect(convertedUserInteraction.created_at).toEqual(
        originalUserInteraction.created_at,
      );
    });
  });
});
