import { Readable } from "node:stream";

import { randomUUID } from "crypto";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ExternalServiceError } from "../../../../shared/domain/errors/external-service.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Notification } from "../../../../shared/domain/validators/notification";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import { PresentationAudio } from "../../../domain/value-objects/presentation-audio.vo";
import { IMusicianStorage } from "../../ports/musician-storage.interface";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../common/musician-profile-output";

/** 10 MB cobre 40s de WAV estéreo 44,1 kHz, que é o formato mais pesado aceito. */
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_MAX_SECONDS = 40;

/**
 * Mínimo de 5s. Um arquivo de meio segundo não responde a pergunta que o
 * preview existe para responder ("como esse artista soa?") e ainda ocupa o
 * lugar de um áudio de verdade na grade.
 */
const MIN_SECONDS = 5;

/**
 * Formatos aceitos → extensão do objeto no bucket.
 *
 * 🔴 **`audio/x-m4a` E `audio/mp4`, os dois.** O `file-type@21` devolve
 * `audio/x-m4a` para um `.m4a` (é o que sai de um iPhone) e `audio/mp4` para
 * outros contêineres MP4 de áudio. Listar só um dos dois reprova metade dos
 * arquivos legítimos — mesma armadilha de vocabulário já documentada em
 * `detect-file-mime.ts`.
 *
 * 🔴 **Ogg e FLAC ficam FORA, de propósito.** O Safari não toca Ogg Vorbis, e
 * não há ffmpeg no processo Node para transcodificar: aceitar seria prometer
 * um preview que parte dos estabelecimentos — quem paga — simplesmente não
 * ouve, sem nenhum erro na tela. FLAC é lossless: peso de banda sem ganho
 * audível em 40 segundos.
 */
const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
};

/**
 * A MESMA lista que o controller usa para cheirar os bytes.
 *
 * Exportada, e não copiada: duas listas divergiriam em silêncio no dia em que
 * alguém aceitasse um formato novo só num dos lados — e o sintoma seria um
 * arquivo que passa na porta e é recusado lá dentro, ou pior, o contrário.
 */
export const PRESENTATION_AUDIO_ALLOWED_MIME_TYPES = Object.freeze(
  Object.keys(ALLOWED_CONTENT_TYPES),
);

export type UploadMusicianPresentationAudioInput = {
  musician_id: string;
  data: Buffer | Readable;
  /** MIME REAL, deduzido dos bytes pelo controller — nunca o do cliente. */
  content_type: string;
  file_size: number;
  /** Duração medida pelo controller. `null` = não foi possível medir. */
  duration_seconds: number | null;
};

export type UploadMusicianPresentationAudioOutput = MusicianOutput;

/**
 * Publica o áudio de apresentação do músico.
 *
 * **O controller apura FATOS, este use-case aplica REGRAS.** O MIME real (magic
 * bytes) e a duração chegam prontos do controller, que é quem tem o arquivo em
 * disco e as ferramentas de infra; aqui ficam a allowlist, os limites e a
 * ordem de escrita. A divisão é a mesma que `content_type` já seguia no upload
 * de avatar, e é o que permite testar "41 segundos" sem um arquivo de áudio.
 */
export class UploadMusicianPresentationAudioUseCase implements IUseCase<
  UploadMusicianPresentationAudioInput,
  UploadMusicianPresentationAudioOutput
> {
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    private readonly storage: IMusicianStorage,
  ) {}

  async execute(
    input: UploadMusicianPresentationAudioInput,
  ): Promise<UploadMusicianPresentationAudioOutput> {
    const maxSize = Number(
      process.env.MUSICIAN_PRESENTATION_AUDIO_MAX_SIZE ?? DEFAULT_MAX_FILE_SIZE,
    );
    const maxSeconds = Number(
      process.env.MUSICIAN_PRESENTATION_AUDIO_MAX_SECONDS ??
        DEFAULT_MAX_SECONDS,
    );

    const extension = ALLOWED_CONTENT_TYPES[input.content_type];
    if (!extension) {
      this.reject(
        "Formato não suportado. Envie um arquivo MP3, M4A, AAC ou WAV.",
      );
    }

    if (input.file_size > maxSize) {
      this.reject(
        `O arquivo tem ${formatMegabytes(input.file_size)} e o limite é ${formatMegabytes(maxSize)}.`,
      );
    }

    if (input.duration_seconds === null) {
      this.reject(
        "Não foi possível ler a duração do áudio. O arquivo pode estar corrompido — tente exportá-lo de novo.",
      );
    }

    // Arredondar antes de comparar: um áudio exportado como "40s" costuma vir
    // com 40,04 no cabeçalho, e reprovar isso seria incompreensível para quem
    // acabou de cortar o trecho em 40 segundos.
    const duration = Math.round(input.duration_seconds!);

    if (duration < MIN_SECONDS) {
      this.reject(
        `O áudio tem ${formatDuration(duration)} e o mínimo é ${MIN_SECONDS} segundos.`,
      );
    }

    if (duration > maxSeconds) {
      this.reject(
        `O áudio tem ${formatDuration(duration)} e o limite é ${maxSeconds} segundos. Corte um trecho menor e envie de novo.`,
      );
    }

    const musicianId = new MusicianId(input.musician_id);
    const musician = await this.musicianRepo.findById(musicianId);

    if (!musician) {
      throw new NotFoundError(input.musician_id, Musician);
    }

    /*
     * Chave NOVA a cada envio (uuid), nunca a mesma sobrescrita: o CDN cacheia
     * por caminho, e reaproveitar a chave continuaria servindo o áudio antigo
     * até alguém invalidar o cache à mão.
     */
    const objectKey = `musicians/${input.musician_id}/presentation-audio/${randomUUID()}.${extension}`;

    await this.storage.putObject({
      object_key: objectKey,
      data: input.data,
      content_type: input.content_type,
    });

    const publicUrl = this.storage.getPublicUrl(objectKey);

    /*
     * 🔴 Aqui NÃO existe o `?? objectKey` do avatar, e a diferença é o produto.
     * Sem base pública configurada, aquele fallback grava a object key crua no
     * campo de URL: numa `<img>` isso vira ícone quebrado, mas num
     * `<audio src="musicians/...">` o browser resolve como caminho RELATIVO à
     * página aberta, pede `/dashboard/artistas/musicians/...` e fica mudo — sem
     * erro para ninguém, com o músico achando que enviou. Falhar alto aqui
     * transforma um silêncio em erro de configuração visível no log.
     */
    if (!publicUrl) {
      await this.storage
        .deleteObject({ object_key: objectKey })
        .catch(() => undefined);
      throw new ExternalServiceError(
        "Não foi possível publicar o áudio: o armazenamento de mídia está sem URL pública configurada.",
        { metadata: { object_key: objectKey } },
      );
    }

    const previousKey = musician.changePresentationAudio(
      new PresentationAudio({
        url: publicUrl,
        object_key: objectKey,
        duration_seconds: duration,
      }),
    );

    if (musician.notification.hasErrors()) {
      throw new EntityValidationError(musician.notification.toJSON());
    }

    await this.musicianRepo.update(musician);

    /*
     * O objeto antigo só some DEPOIS do update, e a falha é engolida: apagar
     * antes deixaria a grade com áudio quebrado se o update falhasse, e
     * derrubar a resposta por causa de uma limpeza de bucket puniria o músico
     * por um arquivo que ele nem sabe que existe.
     */
    if (previousKey) {
      await this.storage
        .deleteObject({ object_key: previousKey })
        .catch(() => undefined);
    }

    return MusicianOutputMapper.toOutput(musician);
  }

  private reject(message: string): never {
    const notification = new Notification();
    notification.addError(message, "file");
    throw new EntityValidationError(notification.toJSON());
  }
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds} segundos`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0
    ? `${minutes}min`
    : `${minutes}min${String(seconds).padStart(2, "0")}`;
}
