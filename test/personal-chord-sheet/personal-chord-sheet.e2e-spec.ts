import { EventEmitterModule } from "@nestjs/event-emitter";
import { randomUUID } from "crypto";

import { ApplyChordEditsUseCase } from "../../src/core/personal-chord-sheet/application/use-cases/apply-chord-edits/apply-chord-edits.use-case";
import { CheckPersonalChordSheetAccessUseCase } from "../../src/core/personal-chord-sheet/application/use-cases/check-personal-chord-sheet-access/check-personal-chord-sheet-access.use-case";
import { ForkChordSheetUseCase } from "../../src/core/personal-chord-sheet/application/use-cases/fork-chord-sheet/fork-chord-sheet.use-case";
import { GetPersonalChordSheetViewUseCase } from "../../src/core/personal-chord-sheet/application/use-cases/get-personal-chord-sheet-view/get-personal-chord-sheet-view.use-case";
import { ImportCommunityChordSheetUseCase } from "../../src/core/personal-chord-sheet/application/use-cases/import-community-chord-sheet/import-community-chord-sheet.use-case";
import { ListPersonalChordSheetsUseCase } from "../../src/core/personal-chord-sheet/application/use-cases/list-personal-chord-sheets/list-personal-chord-sheets.use-case";
import { SharePersonalChordSheetUseCase } from "../../src/core/personal-chord-sheet/application/use-cases/share-personal-chord-sheet/share-personal-chord-sheet.use-case";
import { AuthModule } from "../../src/nest-modules/auth-module/auth.module";
import { ConfigModuleRoot } from "../../src/nest-modules/config-module/config-module.module";
import { PrismaService } from "../../src/nest-modules/database-module/prisma/prisma.service";
import { MailModule } from "../../src/nest-modules/mail-module/mail.module";
import { PersonalChordSheetModule } from "../../src/nest-modules/personal-chord-sheet-module/personal-chord-sheet.module";
import { startApp } from "../../src/nest-modules/shared-module/testing/helpers";

/** O timeline que a "IA" produziu na primeira análise. */
const BASE_TIMELINE = [
  { startMs: 0, endMs: 2000, symbol: "C", confidence: 0.9 },
  { startMs: 2000, endMs: 4000, symbol: "Am", confidence: 0.85 },
  { startMs: 4000, endMs: 6000, symbol: "F", confidence: 0.9 },
  { startMs: 6000, endMs: 8000, symbol: "G", confidence: 0.88 },
];

const LRC = {
  lines: [
    { start_ms: 0, end_ms: 4000, text: "primeira linha da musica" },
    { start_ms: 4000, end_ms: 8000, text: "segunda linha da musica" },
  ],
  meta: { has_word_timestamps: false },
};

describe("Cifra Pessoal — ciclo completo (e2e)", () => {
  // AuthModule é @Global(), mas só exporta seus providers depois de
  // instanciado — sem ele no grafo o AuthGuard não resolve o AuthJwtVerifier.
  // EventEmitterModule pelo mesmo motivo: PersonalChordSheetModule importa
  // MusiciansModule (pelo "BandRepository"), e lá dentro o DomainEventMediator
  // depende do EventEmitter2 que só existe depois do forRoot().
  const appHelper = startApp({
    imports: [
      ConfigModuleRoot.forRoot(),
      EventEmitterModule.forRoot(),
      AuthModule,
      MailModule,
      PersonalChordSheetModule,
    ],
  });

  it("fork → corrigir → ler com overlay → re-análise → compartilhar → importar", async () => {
    const prisma = appHelper.app.get(PrismaService);
    const forkUseCase = appHelper.app.get(ForkChordSheetUseCase);
    const applyEditsUseCase = appHelper.app.get(ApplyChordEditsUseCase);
    const getViewUseCase = appHelper.app.get(GetPersonalChordSheetViewUseCase);
    const listUseCase = appHelper.app.get(ListPersonalChordSheetsUseCase);
    const shareUseCase = appHelper.app.get(SharePersonalChordSheetUseCase);
    const checkAccessUseCase = appHelper.app.get(
      CheckPersonalChordSheetAccessUseCase,
    );
    const importUseCase = appHelper.app.get(ImportCommunityChordSheetUseCase);

    const author_id = randomUUID();
    const reader_id = randomUUID();

    await prisma.musician.createMany({
      data: [
        {
          id: author_id,
          email: `e2e+pcs+author+${author_id}@soundmeet.local`,
          name: "E2E Autor",
        },
        {
          id: reader_id,
          email: `e2e+pcs+reader+${reader_id}@soundmeet.local`,
          name: "E2E Leitor",
        },
      ],
    });

    // Publicar na comunidade exige plano pago (chord_sheet_community_sharing).
    // Sem esta assinatura o autor cai em FREE e o share devolve 402 — que é
    // exatamente o comportamento correto, coberto no int-spec do módulo.
    await prisma.subscription.create({
      data: {
        musician_id: author_id,
        plan_tier: "pro",
        persona: "musician",
        status: "active",
      },
    });

    // Cada músico tem a SUA linha de music_library — MusicLibrary.musicianId é
    // obrigatório, e é por isso que a comunidade precisa de import, não de
    // leitura direta.
    const authorSong = await prisma.musicLibrary.create({
      data: {
        musicianId: author_id,
        title: "Música E2E",
        artist: "Artista E2E",
        lrc_normalized: LRC,
        chords: { timeline: BASE_TIMELINE },
      },
      select: { id: true },
    });

    const readerSong = await prisma.musicLibrary.create({
      data: {
        musicianId: reader_id,
        title: "Música E2E",
        artist: "Artista E2E",
        lrc_normalized: LRC,
        chords: { timeline: BASE_TIMELINE },
      },
      select: { id: true },
    });

    // ─── 1. fork ──────────────────────────────────────────────────────────
    const forked = await forkUseCase.execute({
      musician_id: author_id,
      music_library_id: authorSong.id,
    });

    expect(forked.edits).toEqual([]);
    expect(forked.share_scope).toBe("private");
    expect(forked.reconcile_status).toBe("clean");
    expect(forked.base_fingerprint).toHaveLength(64);

    // ─── 2. corrigir um acorde errado ─────────────────────────────────────
    const edited = await applyEditsUseCase.execute({
      personal_chord_sheet_id: forked.personal_chord_sheet_id,
      musician_id: author_id,
      edits: [{ type: "replace_chord", at_ms: 2000, from: "Am", to: "Am7" }],
    });

    expect(edited.edit_count).toBe(1);

    // ─── 3. ler com o overlay aplicado, transpondo +2 com capô 2 ──────────
    const view = await getViewUseCase.execute({
      personal_chord_sheet_id: forked.personal_chord_sheet_id,
      owner_musician_id: author_id,
      view_override: { transpose_semitones: 2, capo_fret: 2 },
    });

    // A correção entrou...
    expect(view.conflict_count).toBe(0);
    expect(view.outcomes[0].status).toBe("applied");
    // ...e transpose(+2) − capo(2) = 0 semitons de deslocamento efetivo: o
    // músico põe o capô e toca as MESMAS formas, que é o ponto do capotraste.
    expect(view.sheet.chords.timeline.map((c) => c.symbol)).toEqual([
      "C",
      "Am7",
      "F",
      "G",
    ]);
    expect(view.base_changed).toBe(false);

    // Transpondo sem capô o tom sobe de verdade.
    const transposed = await getViewUseCase.execute({
      personal_chord_sheet_id: forked.personal_chord_sheet_id,
      owner_musician_id: author_id,
      view_override: { transpose_semitones: 2 },
    });
    expect(transposed.sheet.chords.timeline.map((c) => c.symbol)).toEqual([
      "D",
      "Bm7",
      "G",
      "A",
    ]);

    // A listagem usa o read-model: edit_count vem de jsonb_array_length no
    // Postgres, e é aqui que a SQL crua é exercitada de verdade.
    const listed = await listUseCase.execute({ musician_id: author_id });
    const row = listed.items.find(
      (i) => i.personal_chord_sheet_id === forked.personal_chord_sheet_id,
    );
    expect(row?.edit_count).toBe(1);
    expect(row).not.toHaveProperty("edits");

    // ─── 4. a IA re-analisa a música ──────────────────────────────────────
    await prisma.musicLibrary.update({
      where: { id: authorSong.id },
      data: {
        chords: {
          timeline: [
            { startMs: 0, endMs: 2000, symbol: "C", confidence: 0.95 },
            { startMs: 2000, endMs: 4000, symbol: "Am", confidence: 0.91 },
            { startMs: 4000, endMs: 6000, symbol: "Fmaj7", confidence: 0.93 },
            { startMs: 6000, endMs: 8000, symbol: "G", confidence: 0.9 },
          ],
        },
      },
    });

    const afterReanalysis = await getViewUseCase.execute({
      personal_chord_sheet_id: forked.personal_chord_sheet_id,
      owner_musician_id: author_id,
    });

    expect(afterReanalysis.base_changed).toBe(true);
    expect(afterReanalysis.reconcile_status).toBe("base_updated");
    // A correção continua ancorando: o Am de 2000ms sobreviveu à re-análise.
    expect(afterReanalysis.sheet.chords.timeline.map((c) => c.symbol)).toEqual([
      "C",
      "Am7",
      "Fmaj7",
      "G",
    ]);

    // Leitura NÃO escreve: o fork no banco segue "clean".
    const persisted = await prisma.personalChordSheet.findUnique({
      where: { id: forked.personal_chord_sheet_id },
      select: { reconcile_status: true, base_fingerprint: true },
    });
    expect(persisted?.reconcile_status).toBe("clean");
    expect(persisted?.base_fingerprint).toBe(forked.base_fingerprint);

    // ─── 5. compartilhar com a comunidade ─────────────────────────────────
    const shared = await shareUseCase.execute({
      personal_chord_sheet_id: forked.personal_chord_sheet_id,
      musician_id: author_id,
      scope: "community",
    });
    expect(shared.share_scope).toBe("community");
    expect(shared.shared_at).not.toBeNull();

    // ─── 6. o segundo músico lê pela comunidade ───────────────────────────
    const access = await checkAccessUseCase.execute({
      personal_chord_sheet_id: forked.personal_chord_sheet_id,
      requesting_musician_id: reader_id,
    });
    expect(access.is_owner).toBe(false);
    expect(access.owner_musician_id).toBe(author_id);

    // A leitura passa pelo id do DONO — a linha de music_library é dele.
    const readerView = await getViewUseCase.execute({
      personal_chord_sheet_id: forked.personal_chord_sheet_id,
      owner_musician_id: access.owner_musician_id,
    });
    expect(readerView.sheet.chords.timeline.map((c) => c.symbol)).toContain(
      "Am7",
    );

    // ─── 7. importar para a própria cifra ─────────────────────────────────
    const imported = await importUseCase.execute({
      source_personal_chord_sheet_id: forked.personal_chord_sheet_id,
      musician_id: reader_id,
      target_music_library_id: readerSong.id,
    });

    expect(imported.personal_chord_sheet.musician_id).toBe(reader_id);
    expect(imported.personal_chord_sheet.music_library_id).toBe(readerSong.id);
    expect(imported.conflict_count).toBe(0);
    expect(imported.personal_chord_sheet.edit_count).toBe(1);

    // A correção foi REANCORADA contra a análise do leitor, não copiada às
    // cegas — e aparece na cifra dele.
    const importedView = await getViewUseCase.execute({
      personal_chord_sheet_id:
        imported.personal_chord_sheet.personal_chord_sheet_id,
      owner_musician_id: reader_id,
    });
    expect(importedView.sheet.chords.timeline.map((c) => c.symbol)).toEqual([
      "C",
      "Am7",
      "F",
      "G",
    ]);

    // As anotações do autor nunca chegam ao importador.
    expect(imported.personal_chord_sheet.notes).toBeNull();

    // ─── limpeza ──────────────────────────────────────────────────────────
    await prisma.personalChordSheet.deleteMany({
      where: { musician_id: { in: [author_id, reader_id] } },
    });
    await prisma.subscription.deleteMany({
      where: { musician_id: { in: [author_id, reader_id] } },
    });
    await prisma.musicLibrary.deleteMany({
      where: { musicianId: { in: [author_id, reader_id] } },
    });
    await prisma.musician.deleteMany({
      where: { id: { in: [author_id, reader_id] } },
    });
  });
});
