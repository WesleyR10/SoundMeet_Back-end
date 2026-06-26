import { EntityValidationError } from "../../../shared/domain/validators/validation.error";
import { Repertoire, RepertoireId, RepertoireSong } from "../repertoire.aggregate";
import { RepertoireFakeBuilder } from "../repertoire-fake.builder";

const makeSong = (overrides: Partial<{ music_library_id: string }> = {}): RepertoireSong =>
  RepertoireSong.create({
    music_library_id: overrides.music_library_id ?? "lib-1",
    custom_notes: null,
    duration_override_seconds: null,
  });

describe("Repertoire aggregate", () => {
  describe("create()", () => {
    it("should create a valid Repertoire", () => {
      const r = Repertoire.create({ musician_id: "m1", name: "Setlist Principal" });
      expect(r.musician_id).toBe("m1");
      expect(r.name).toBe("Setlist Principal");
      expect(r.songs).toHaveLength(0);
      expect(r.invitees).toHaveLength(0);
      expect(r.is_shared).toBe(false);
      expect(r.share_token).toBeNull();
    });

    it("should throw EntityValidationError for empty name", () => {
      expect(() => Repertoire.create({ musician_id: "m1", name: "" })).toThrow(
        EntityValidationError,
      );
    });

    it("should throw EntityValidationError for name exceeding 255 chars", () => {
      expect(() =>
        Repertoire.create({ musician_id: "m1", name: "a".repeat(256) }),
      ).toThrow(EntityValidationError);
    });
  });

  describe("rename()", () => {
    it("should update name", () => {
      const r = RepertoireFakeBuilder.aRepertoire().build();
      r.rename("Novo Nome");
      expect(r.name).toBe("Novo Nome");
    });

    it("should throw for empty name", () => {
      const r = RepertoireFakeBuilder.aRepertoire().build();
      expect(() => r.rename("")).toThrow(EntityValidationError);
    });
  });

  describe("songs management", () => {
    it("addSong should append and assign correct position", () => {
      const r = RepertoireFakeBuilder.aRepertoire().build();
      r.addSong(makeSong({ music_library_id: "lib-1" }));
      r.addSong(makeSong({ music_library_id: "lib-2" }));
      expect(r.songs).toHaveLength(2);
      expect(r.songs[0].position).toBe(1);
      expect(r.songs[1].position).toBe(2);
    });

    it("removeSong should recompute positions without gaps", () => {
      const r = RepertoireFakeBuilder.aRepertoire().build();
      const s1 = makeSong({ music_library_id: "lib-1" });
      const s2 = makeSong({ music_library_id: "lib-2" });
      const s3 = makeSong({ music_library_id: "lib-3" });
      r.addSong(s1);
      r.addSong(s2);
      r.addSong(s3);
      r.removeSong(s2.song_id);
      expect(r.songs).toHaveLength(2);
      expect(r.songs.map((s) => s.position)).toEqual([1, 2]);
    });

    it("reorderSongs should recompute positions atomically", () => {
      const r = RepertoireFakeBuilder.aRepertoire().build();
      const s1 = makeSong({ music_library_id: "lib-1" });
      const s2 = makeSong({ music_library_id: "lib-2" });
      const s3 = makeSong({ music_library_id: "lib-3" });
      r.addSong(s1);
      r.addSong(s2);
      r.addSong(s3);
      r.reorderSongs([s3.song_id, s1.song_id, s2.song_id]);
      expect(r.songs[0].song_id).toBe(s3.song_id);
      expect(r.songs[0].position).toBe(1);
      expect(r.songs[1].song_id).toBe(s1.song_id);
      expect(r.songs[1].position).toBe(2);
      expect(r.songs[2].song_id).toBe(s2.song_id);
      expect(r.songs[2].position).toBe(3);
    });

    it("reorderSongs should throw if song_ids set does not match", () => {
      const r = RepertoireFakeBuilder.aRepertoire().build();
      const s1 = makeSong({ music_library_id: "lib-1" });
      r.addSong(s1);
      expect(() => r.reorderSongs(["nonexistent-id"])).toThrow();
    });
  });

  describe("sharing", () => {
    it("share() should generate a token and set is_shared=true", () => {
      const r = RepertoireFakeBuilder.aRepertoire().build();
      r.share();
      expect(r.is_shared).toBe(true);
      expect(r.share_token).not.toBeNull();
      expect(r.share_token_expires_at).not.toBeNull();
    });

    it("share token expires 7 days from now", () => {
      const r = RepertoireFakeBuilder.aRepertoire().build();
      r.share();
      const diffMs = r.share_token_expires_at!.getTime() - Date.now();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(6.9);
      expect(diffDays).toBeLessThan(7.1);
    });

    it("isShareTokenValid() returns false for expired token", () => {
      const r = RepertoireFakeBuilder.aRepertoire().build();
      r.share();
      r["share_token_expires_at"] = new Date(Date.now() - 1000);
      expect(r.isShareTokenValid()).toBe(false);
    });

    it("unshare() should clear token and set is_shared=false", () => {
      const r = RepertoireFakeBuilder.aRepertoire().build();
      r.share();
      r.unshare();
      expect(r.is_shared).toBe(false);
      expect(r.share_token).toBeNull();
      expect(r.share_token_expires_at).toBeNull();
    });
  });

  describe("nominal invites", () => {
    it("inviteMusician should add invitee", () => {
      const r = RepertoireFakeBuilder.aRepertoire().build();
      r.inviteMusician("musician-2");
      expect(r.invitees).toHaveLength(1);
      expect(r.invitees[0].musician_id).toBe("musician-2");
    });

    it("should throw if musician already invited", () => {
      const r = RepertoireFakeBuilder.aRepertoire().build();
      r.inviteMusician("musician-2");
      expect(() => r.inviteMusician("musician-2")).toThrow();
    });

    it("revokeInvite should remove by invitee_id", () => {
      const r = RepertoireFakeBuilder.aRepertoire().build();
      r.inviteMusician("musician-2");
      const inviteeId = r.invitees[0].id;
      r.revokeInvite(inviteeId);
      expect(r.invitees).toHaveLength(0);
    });
  });

  describe("getEstimatedShowDuration()", () => {
    it("should return null if any song lacks duration", () => {
      const r = RepertoireFakeBuilder.aRepertoire().build();
      r.addSong(makeSong({ music_library_id: "lib-1" }));
      r.addSong(makeSong({ music_library_id: "lib-2" }));
      const durations = new Map<string, number | null>([
        ["lib-1", 200],
        ["lib-2", null],
      ]);
      expect(r.getEstimatedShowDuration(durations)).toBeNull();
    });

    it("should return total in minutes when all songs have duration", () => {
      const r = RepertoireFakeBuilder.aRepertoire().build();
      r.addSong(makeSong({ music_library_id: "lib-1" }));
      r.addSong(makeSong({ music_library_id: "lib-2" }));
      const durations = new Map<string, number | null>([
        ["lib-1", 180],
        ["lib-2", 220],
      ]);
      // 180+220 = 400 seconds = 6.67 minutes
      expect(r.getEstimatedShowDuration(durations)).toBeCloseTo(6.67, 1);
    });

    it("should use duration_override when set", () => {
      const r = RepertoireFakeBuilder.aRepertoire().build();
      const song = RepertoireSong.create({
        music_library_id: "lib-1",
        custom_notes: null,
        duration_override_seconds: 100,
      });
      r.addSong(song);
      // library says 300 but override is 100 → 100 seconds = 1.67 minutes
      const durations = new Map<string, number | null>([["lib-1", 300]]);
      expect(r.getEstimatedShowDuration(durations)).toBeCloseTo(1.67, 1);
    });

    it("should return null for empty repertoire", () => {
      const r = RepertoireFakeBuilder.aRepertoire().build();
      expect(r.getEstimatedShowDuration(new Map())).toBeNull();
    });
  });

  describe("fake builder", () => {
    it("RepertoireId should be a Uuid", () => {
      const r = RepertoireFakeBuilder.aRepertoire().build();
      expect(r.repertoire_id).toBeInstanceOf(RepertoireId);
    });

    it("toJSON should return all fields", () => {
      const r = RepertoireFakeBuilder.aRepertoire().build();
      const json = r.toJSON();
      expect(json).toHaveProperty("repertoire_id");
      expect(json).toHaveProperty("musician_id");
      expect(json).toHaveProperty("name");
      expect(json).toHaveProperty("songs");
      expect(json).toHaveProperty("invitees");
    });
  });
});
