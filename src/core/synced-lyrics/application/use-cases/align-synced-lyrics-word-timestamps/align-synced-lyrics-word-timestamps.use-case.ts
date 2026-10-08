import {
  ISyncedLyricsRepository,
  SyncedLyricsId,
} from "@core/synced-lyrics/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ILyricsAlignmentClient } from "../../ports/lyrics-alignment-client.interface";

export type AlignSyncedLyricsWordTimestampsInput = {
  music_library_id: string;
  audio_object_key: string;
  lang_code?: string;
};

// Use-case interno (nunca exposto por controller) -- ver
// Docs/ia-musical/folha-de-cifra.md "Alinhamento forçado (MMS_FA)". Chamado
// SÓ a partir de ai-cifra-module, logo antes de apagar o objeto de áudio do
// storage (ver ProcessAiCifraAnalysisJobUseCase/CompleteAiCifraAnalysisJobUseCase)
// -- é o único ponto onde o áudio original ainda existe E pode já haver
// letra sincronizada. Se a letra ainda não tiver sido sincronizada nesse
// momento (ordem mais comum: cifra primeiro, letra depois), este use-case
// vira um no-op silencioso -- não há re-tentativa depois, porque o áudio já
// terá sido apagado do storage por essa altura. Limitação conhecida da
// arquitetura atual, não deste use-case.
export class AlignSyncedLyricsWordTimestampsUseCase implements IUseCase<
  AlignSyncedLyricsWordTimestampsInput,
  void
> {
  constructor(
    private readonly repo: ISyncedLyricsRepository,
    private readonly client: ILyricsAlignmentClient,
  ) {}

  async execute(input: AlignSyncedLyricsWordTimestampsInput): Promise<void> {
    const id = new SyncedLyricsId(input.music_library_id);
    const entity = await this.repo.findById(id);
    if (!entity || !entity.lrc_normalized) return;

    const lines = entity.lrc_normalized.lines
      .map((line, index) => ({
        index,
        text: line.text,
        start_ms: line.start_ms,
        end_ms: line.end_ms,
      }))
      .filter((l) => l.text.trim().length > 0);
    if (lines.length === 0) return;

    const response = await this.client.align({
      input_object_key: input.audio_object_key,
      lang_code: input.lang_code,
      lines,
    });

    if (!response.lines || response.lines.length === 0) return;

    entity.applyWordAlignment(
      {
        lines: response.lines.map((l) => ({
          index: l.index,
          words: l.words.map((w) => ({
            text: w.text,
            start_ms: w.start_ms,
            end_ms: w.end_ms,
          })),
        })),
      },
      new Date(),
    );

    if (entity.notification.hasErrors()) return;

    await this.repo.update(entity);
  }
}
