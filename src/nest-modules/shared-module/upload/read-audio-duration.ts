/**
 * Lê a duração de um arquivo de áudio, em segundos, a partir do cabeçalho.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE NÃO É ffprobe
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Não existe ffmpeg no processo Node deste projeto — ele só vive no
 * `ai-cifra-mir-worker` (Python), que é outro contêiner e trabalha de forma
 * assíncrona, por fila. Todo `duration_seconds` do sistema hoje vem de fora
 * (worker MIR, Spotify, lrclib). Para validar "até 40s" **dentro da
 * requisição** — que é o que faz o músico receber um erro acionável em vez de
 * descobrir depois — a alternativa seria acrescentar o binário do ffmpeg à
 * imagem de produção. `music-metadata` é JavaScript puro, lê o cabeçalho e
 * resolve o mesmo problema sem mudar a imagem.
 *
 * ⚠️ **Import dinâmico**: `music-metadata` é ESM puro e este projeto compila
 * para CommonJS — o `tsc` transforma este `await import()` em `require()`, que
 * funciona porque o Node ≥ 20.19 suporta `require(esm)`. É exatamente o mesmo
 * arranjo do `file-type` em `detect-file-mime.ts`; se um dia um deles quebrar,
 * quebram os dois pelo mesmo motivo.
 *
 * 🔴 **Isto é um parser de terceiros lendo arquivo hostil dentro do processo da
 * API.** Duas defesas em volta, e nenhuma dispensa a outra: o chamador só
 * chega aqui **depois** do `assertFileSignature` (então os bytes já são de um
 * formato de áudio conhecido), e o limite de tamanho do multer já barrou
 * qualquer coisa grande. O que sobra é um arquivo malformado fazendo o parser
 * lançar — e é por isso que este helper **nunca propaga exceção**: devolve
 * `null`, e quem chamou transforma em 422 com mensagem, em vez de 500 genérico
 * com alerta no Sentry.
 *
 * @returns duração em segundos, ou `null` quando o arquivo não permite medir.
 */
export async function readAudioDurationSeconds(
  filePath: string,
): Promise<number | null> {
  try {
    const { parseFile } = await import("music-metadata");
    const metadata = await parseFile(filePath, { duration: true });
    const duration = metadata.format.duration;

    if (typeof duration !== "number" || !Number.isFinite(duration)) {
      return null;
    }

    return duration > 0 ? duration : null;
  } catch {
    return null;
  }
}
