export type LyricsAlignmentLineInput = {
  index: number;
  text: string;
  start_ms: number;
  end_ms: number | null;
};

export type LyricsAlignmentWordOutput = {
  text: string;
  start_ms: number;
  end_ms: number;
};

export type LyricsAlignmentLineOutput = {
  index: number;
  words: LyricsAlignmentWordOutput[];
};

export type LyricsAlignmentClientRequest = {
  job_id?: string | null;
  input_object_key: string;
  lang_code?: string;
  lines: LyricsAlignmentLineInput[];
};

export type LyricsAlignmentClientResponse = {
  lines: LyricsAlignmentLineOutput[];
};

// Chama o worker de IA (ai-cifra-mir-worker, POST /v1/align-lyrics) — ver
// app/lyrics_alignment_service.py naquele repo pro racional completo
// (MMS_FA + uroman). NÃO confundir com IAiCifraAnalysisClient: acordes e
// alinhamento de letra são endpoints/fluxos independentes no worker (podem
// terminar em qualquer ordem no lado do backend).
export interface ILyricsAlignmentClient {
  align(
    input: LyricsAlignmentClientRequest,
  ): Promise<LyricsAlignmentClientResponse>;
}
