import { Prisma } from "@prisma/client";

import { ConflictError } from "../../../../../shared/domain/errors/conflict.error";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import {
  PersonalChordSheet,
  PersonalChordSheetId,
} from "../../../../domain/personal-chord-sheet.aggregate";
import { PersonalChordSheetSearchParams } from "../../../../domain/personal-chord-sheet.repository";
import { ChordEdit } from "../../../../domain/value-objects/chord-edit.vo";
import { ChordSheetViewSettings } from "../../../../domain/value-objects/chord-sheet-view-settings.vo";
import { PersonalChordSheetPrismaRepository } from "../personal-chord-sheet-prisma.repository";

const FINGERPRINT = "a".repeat(64);

const aModel = (overrides: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  musician_id: "22222222-2222-4222-8222-222222222222",
  music_library_id: "33333333-3333-4333-8333-333333333333",
  base_version: 0,
  base_fingerprint: FINGERPRINT,
  base_pipeline_version: 1,
  edits: [],
  view: null,
  notes: null,
  share_scope: "private",
  shared_at: null,
  reconcile_status: "clean",
  created_at: new Date("2026-07-28T00:00:00.000Z"),
  updated_at: new Date("2026-07-28T00:00:00.000Z"),
  ...overrides,
});

describe("PersonalChordSheetPrismaRepository", () => {
  let repository: PersonalChordSheetPrismaRepository;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      personalChordSheet: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    repository = new PersonalChordSheetPrismaRepository(prisma);
  });

  describe("insert", () => {
    it("persiste edits e view serializados", async () => {
      const entity = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withOneEdit()
        .withView(ChordSheetViewSettings.create({ transpose_semitones: 2 }))
        .build();

      await repository.insert(entity);

      expect(prisma.personalChordSheet.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: entity.personal_chord_sheet_id.id,
          musician_id: entity.musician_id,
          music_library_id: entity.music_library_id,
          base_fingerprint: entity.base_fingerprint,
          share_scope: "private",
        }),
      });

      const data = prisma.personalChordSheet.create.mock.calls[0][0].data;
      expect(data.edits).toHaveLength(1);
      expect(data.edits[0]).toMatchObject({ type: "replace_chord", to: "Am7" });
      expect(data.view).toMatchObject({ transpose_semitones: 2 });
    });

    /**
     * O caminho que a regra "1 fork por música" realmente depende: dois POSTs
     * simultâneos passam pela checagem da aplicação e só o índice único segura.
     */
    it("converte P2002 do índice único em ConflictError", async () => {
      prisma.personalChordSheet.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "7.2.0",
          meta: { target: ["musician_id", "music_library_id"] },
        }),
      );

      await expect(
        repository.insert(
          PersonalChordSheet.fake().aPersonalChordSheet().build(),
        ),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("update", () => {
    it("atualiza pelo id", async () => {
      const entity = PersonalChordSheet.fake().aPersonalChordSheet().build();

      await repository.update(entity);

      expect(prisma.personalChordSheet.update).toHaveBeenCalledWith({
        where: { id: entity.personal_chord_sheet_id.id },
        data: expect.objectContaining({
          id: entity.personal_chord_sheet_id.id,
        }),
      });
    });

    it("converte P2025 em NotFoundError", async () => {
      prisma.personalChordSheet.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Record not found", {
          code: "P2025",
          clientVersion: "7.2.0",
        }),
      );

      await expect(
        repository.update(
          PersonalChordSheet.fake().aPersonalChordSheet().build(),
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("delete", () => {
    it("converte P2025 em NotFoundError", async () => {
      prisma.personalChordSheet.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Record not found", {
          code: "P2025",
          clientVersion: "7.2.0",
        }),
      );

      await expect(
        repository.delete(new PersonalChordSheetId()),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("findByMusicianAndMusicLibrary", () => {
    it("consulta pelo índice único composto", async () => {
      prisma.personalChordSheet.findUnique.mockResolvedValue(aModel());

      const found = await repository.findByMusicianAndMusicLibrary(
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
      );

      expect(prisma.personalChordSheet.findUnique).toHaveBeenCalledWith({
        where: {
          musician_id_music_library_id: {
            musician_id: "22222222-2222-4222-8222-222222222222",
            music_library_id: "33333333-3333-4333-8333-333333333333",
          },
        },
      });
      expect(found).toBeInstanceOf(PersonalChordSheet);
    });

    it("devolve null quando não existe", async () => {
      prisma.personalChordSheet.findUnique.mockResolvedValue(null);
      expect(
        await repository.findByMusicianAndMusicLibrary("a", "b"),
      ).toBeNull();
    });
  });

  describe("findSharedByMusicLibraryId", () => {
    it("sem escopo, traz tudo que não é privado", async () => {
      prisma.personalChordSheet.findMany.mockResolvedValue([]);

      await repository.findSharedByMusicLibraryId("music-1");

      expect(prisma.personalChordSheet.findMany).toHaveBeenCalledWith({
        where: { music_library_id: "music-1", share_scope: { not: "private" } },
        orderBy: { shared_at: "desc" },
      });
    });

    it("com escopo, filtra exatamente por ele", async () => {
      prisma.personalChordSheet.findMany.mockResolvedValue([]);

      await repository.findSharedByMusicLibraryId("music-1", "community");

      expect(prisma.personalChordSheet.findMany).toHaveBeenCalledWith({
        where: { music_library_id: "music-1", share_scope: "community" },
        orderBy: { shared_at: "desc" },
      });
    });
  });

  describe("search", () => {
    it("aplica filtros, paginação e ordenação padrão", async () => {
      prisma.$transaction.mockResolvedValue([0, []]);

      await repository.search(
        PersonalChordSheetSearchParams.create({
          page: 2,
          per_page: 10,
          filter: { musician_id: "m-1", reconcile_status: "base_updated" },
        }),
      );

      expect(prisma.personalChordSheet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { musician_id: "m-1", reconcile_status: "base_updated" },
          skip: 10,
          take: 10,
          orderBy: { updated_at: "desc" },
        }),
      );
    });

    it("ignora campo de ordenação não permitido, preservando a direção pedida", async () => {
      prisma.$transaction.mockResolvedValue([0, []]);

      await repository.search(
        PersonalChordSheetSearchParams.create({ sort: "notes" as never }),
      );

      // sort_dir vira "asc" na classe base assim que há sort explícito; o campo
      // inválido cai para updated_at mas a direção do cliente é respeitada.
      expect(prisma.personalChordSheet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { updated_at: "asc" } }),
      );
    });

    /**
     * Regressão do setter de filtro: sem o override, a classe base faz
     * `${value}` e o filtro inteiro some, devolvendo o catálogo de todo mundo
     * numa rota que deveria ser escopada a um músico.
     */
    it("preserva o filtro-objeto em vez de stringificá-lo", () => {
      const params = PersonalChordSheetSearchParams.create({
        filter: { musician_id: "m-1", share_scope: "community" },
      });

      expect(params.filter).toEqual({
        musician_id: "m-1",
        share_scope: "community",
      });
    });

    it("filtro vazio vira null", () => {
      expect(
        PersonalChordSheetSearchParams.create({ filter: {} }).filter,
      ).toBeNull();
    });
  });

  /**
   * Um edit corrompido no Json não pode impedir o músico de abrir a cifra —
   * ainda mais no meio de um show.
   */
  describe("tolerância a Json sujo", () => {
    it("descarta edits inválidos e carrega o resto", async () => {
      const bom = ChordEdit.replaceChord({
        at_ms: 1000,
        from: "Am",
        to: "Am7",
      });
      prisma.personalChordSheet.findUnique.mockResolvedValue(
        aModel({
          edits: [
            JSON.parse(JSON.stringify(bom)),
            { type: "explode", at_ms: 0 },
            null,
            "lixo",
          ],
        }),
      );

      const entity = await repository.findById(new PersonalChordSheetId());

      expect(entity!.edits).toHaveLength(1);
      expect(entity!.edits[0].edit_id).toBe(bom.edit_id);
    });

    it("edits não-array vira lista vazia em vez de explodir", async () => {
      prisma.personalChordSheet.findUnique.mockResolvedValue(
        aModel({ edits: { isso: "não é array" } }),
      );

      const entity = await repository.findById(new PersonalChordSheetId());
      expect(entity!.edits).toEqual([]);
    });

    it("view corrompida cai no default", async () => {
      prisma.personalChordSheet.findUnique.mockResolvedValue(
        aModel({ view: "não é objeto" }),
      );

      const entity = await repository.findById(new PersonalChordSheetId());
      expect(entity!.view.toJSON()).toEqual(
        ChordSheetViewSettings.default().toJSON(),
      );
    });

    it("share_scope desconhecido cai no MAIS RESTRITIVO, nunca vaza", async () => {
      prisma.personalChordSheet.findUnique.mockResolvedValue(
        aModel({ share_scope: "mundial" }),
      );

      const entity = await repository.findById(new PersonalChordSheetId());
      expect(entity!.share_scope).toBe("private");
      expect(entity!.is_shared).toBe(false);
    });

    it("reconcile_status desconhecido cai em clean", async () => {
      prisma.personalChordSheet.findUnique.mockResolvedValue(
        aModel({ reconcile_status: "sei lá" }),
      );

      const entity = await repository.findById(new PersonalChordSheetId());
      expect(entity!.reconcile_status).toBe("clean");
    });
  });

  describe("round-trip mapper", () => {
    it("toModel → toEntity preserva o agregado", async () => {
      const original = PersonalChordSheet.fake()
        .aPersonalChordSheet()
        .withOneEdit()
        .withView(
          ChordSheetViewSettings.create({
            transpose_semitones: -2,
            capo_fret: 3,
            chord_complexity: "simple",
            instrument: "cavaquinho",
          }),
        )
        .withNotes("afinar meio tom abaixo")
        .withShareScope("community")
        .build();

      await repository.insert(original);
      const persisted = prisma.personalChordSheet.create.mock.calls[0][0].data;

      prisma.personalChordSheet.findUnique.mockResolvedValue(
        JSON.parse(JSON.stringify(persisted), (key, value) =>
          key === "created_at" || key === "updated_at" || key === "shared_at"
            ? value === null
              ? null
              : new Date(value)
            : value,
        ),
      );

      const restored = await repository.findById(
        original.personal_chord_sheet_id,
      );

      expect(restored!.personal_chord_sheet_id.id).toBe(
        original.personal_chord_sheet_id.id,
      );
      expect(restored!.base_fingerprint).toBe(original.base_fingerprint);
      expect(restored!.notes).toBe(original.notes);
      expect(restored!.share_scope).toBe("community");
      expect(restored!.view.toJSON()).toEqual(original.view.toJSON());
      expect(restored!.edits).toHaveLength(1);
      expect(restored!.edits[0].toJSON()).toEqual(original.edits[0].toJSON());
    });
  });
});
