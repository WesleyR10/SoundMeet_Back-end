import { Prisma } from "@prisma/client";

import { DomainError } from "../../../../../shared/domain/errors/domain.error";
import { InvalidArgumentError } from "../../../../../shared/domain/errors/invalid-argument.error";
import { InvariantViolationError } from "../../../../../shared/domain/errors/invariant-violation.error";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { SyncedLyrics, SyncedLyricsId } from "../../../../domain";
import { SyncedLyricsSearchParams } from "../../../../domain/synced-lyrics.repository";
import { SyncedLyricsPrismaRepository } from "../synced-lyrics-prisma.repository";

describe("SyncedLyricsPrismaRepository", () => {
  let repository: SyncedLyricsPrismaRepository;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      musicLibrary: {
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    repository = new SyncedLyricsPrismaRepository(prisma);
  });

  describe("update", () => {
    it("should update lrc fields on music library", async () => {
      const entity = SyncedLyrics.fake().aSyncedLyrics().build();

      await repository.update(entity);

      expect(prisma.musicLibrary.update).toHaveBeenCalledWith({
        where: { id: entity.music_library_id.id },
        data: expect.objectContaining({
          lrc_raw: entity.lrc_raw,
          lrc_hash: entity.lrc_hash,
          lrc_provider: entity.lrc_provider,
        }),
      });
    });

    it("should throw NotFoundError when music library not found", async () => {
      const entity = SyncedLyrics.fake().aSyncedLyrics().build();
      (prisma.musicLibrary.update as jest.Mock).mockRejectedValue({
        code: "P2025",
      });

      await expect(repository.update(entity)).rejects.toThrow(
        new NotFoundError(entity.music_library_id.id, SyncedLyrics),
      );
    });

    it("should rethrow other errors", async () => {
      const entity = SyncedLyrics.fake().aSyncedLyrics().build();
      const error = new Error("Database error");
      (prisma.musicLibrary.update as jest.Mock).mockRejectedValue(error);

      try {
        await repository.update(entity);
        throw new InvariantViolationError(
          "Expected repository.update to throw",
        );
      } catch (e: any) {
        expect(e).toBeInstanceOf(DomainError);
        expect(e.message).toBe("Database error");
        expect((e as any).cause).toBe(error);
      }
    });
  });

  describe("delete", () => {
    it("should clear lrc fields", async () => {
      const id = new SyncedLyricsId();
      await repository.delete(id);

      expect(prisma.musicLibrary.update).toHaveBeenCalledWith({
        where: { id: id.id },
        data: expect.objectContaining({
          lrc_raw: null,
          lrc_normalized: Prisma.DbNull,
          lrc_provider: null,
          lrc_provider_meta: Prisma.DbNull,
          lrc_hash: null,
          lrc_quality_flags: [],
          lrc_coverage_ms: null,
          lrc_has_word_timestamps: false,
          lrc_version: { increment: 1 },
        }),
      });
    });
  });

  describe("existsById", () => {
    it("should throw InvalidArgumentError when ids array is empty", async () => {
      await expect(repository.existsById([])).rejects.toThrow(
        new InvalidArgumentError(
          "ids must be an array with at least one element",
        ),
      );
    });
  });

  describe("search", () => {
    it("should build query and order", async () => {
      prisma.musicLibrary.findMany.mockResolvedValue([]);
      prisma.musicLibrary.count.mockResolvedValue(0);

      const params = SyncedLyricsSearchParams.create({
        page: 1,
        per_page: 10,
        sort: "title",
        sort_dir: "asc",
        filter: {
          musician_id: "550e8400-e29b-41d4-a716-446655440001",
          query: "hello",
          has_lrc: true,
          provider: "ugc",
          hash: "abc",
        },
      });

      await repository.search(params);

      expect(prisma.musicLibrary.findMany).toHaveBeenCalledWith({
        where: {
          musicianId: "550e8400-e29b-41d4-a716-446655440001",
          OR: [
            {
              title: {
                contains: "hello",
                mode: "insensitive",
              },
            },
            {
              artist: {
                contains: "hello",
                mode: "insensitive",
              },
            },
          ],
          lrc_raw: { not: null },
          lrc_provider: "ugc",
          lrc_hash: "abc",
        },
        orderBy: { title: "asc" },
        skip: 0,
        take: 10,
      });
    });
  });
});
