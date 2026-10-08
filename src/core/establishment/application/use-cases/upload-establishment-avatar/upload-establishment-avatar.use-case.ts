import { Readable } from "node:stream";

import { randomUUID } from "crypto";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Notification } from "../../../../shared/domain/validators/notification";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  Establishment,
  EstablishmentId,
} from "../../../domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../domain/establishment.repository";
import { IEstablishmentStorage } from "../../ports/establishment-storage.interface";
import {
  EstablishmentOutput,
  EstablishmentOutputMapper,
} from "../common/establishment-output";

/**
 * 2 MB — metade da capa.
 *
 * A foto de perfil é exibida em no máximo ~96px e o painel web a recorta e
 * reduz para 512×512 antes de enviar (40–150 KB). O teto existe para quem
 * chama a API sem passar pelo painel; e é baixo porque a foto aparece em toda
 * conversa, lista e cartão — é o asset do espaço que mais vezes é baixado.
 */
const DEFAULT_MAX_FILE_SIZE = 2 * 1024 * 1024;

/**
 * ⚠️ Vocabulário do `file-type`, não do `Content-Type` do cliente — o
 * controller detecta pelos BYTES. Mesma allowlist da capa, e sem SVG de
 * propósito: um SVG é documento com script, não imagem, e servido do nosso
 * domínio de mídia seria XSS armazenado.
 */
const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type UploadEstablishmentAvatarInput = {
  establishment_id: string;
  data: Buffer | Readable;
  content_type: string;
  file_size: number;
};

export type UploadEstablishmentAvatarOutput = EstablishmentOutput;

/**
 * Envia a foto de perfil (logo) do espaço.
 *
 * Espelho de `UploadEstablishmentCoverUseCase`, e a simetria é o ponto: as
 * duas imagens do espaço vivem no mesmo bucket, com o mesmo par URL + chave, e
 * a mesma ordem gravar → persistir → apagar a anterior. Uma divergência entre
 * as duas seria o lugar exato onde um objeto órfão nasceria.
 */
export class UploadEstablishmentAvatarUseCase implements IUseCase<
  UploadEstablishmentAvatarInput,
  UploadEstablishmentAvatarOutput
> {
  constructor(
    private readonly establishmentRepo: IEstablishmentRepository,
    private readonly storage: IEstablishmentStorage,
  ) {}

  async execute(
    input: UploadEstablishmentAvatarInput,
  ): Promise<UploadEstablishmentAvatarOutput> {
    const maxSize = Number(
      process.env.ESTABLISHMENT_AVATAR_MAX_SIZE ?? DEFAULT_MAX_FILE_SIZE,
    );

    if (input.file_size > maxSize) {
      const n = new Notification();
      n.addError(
        `File size exceeds the maximum allowed (${maxSize} bytes)`,
        "file",
      );
      throw new EntityValidationError(n.toJSON());
    }

    const extension = ALLOWED_CONTENT_TYPES[input.content_type];
    if (!extension) {
      const n = new Notification();
      n.addError("Only JPEG, PNG or WEBP images are allowed", "file");
      throw new EntityValidationError(n.toJSON());
    }

    const establishmentId = new EstablishmentId(input.establishment_id);
    const establishment =
      await this.establishmentRepo.findById(establishmentId);

    if (!establishment) {
      throw new NotFoundError(input.establishment_id, Establishment);
    }

    /*
     * Chave nova (UUID) a cada upload, nunca `avatar.jpg` fixo — mesma razão da
     * capa: o CDN guarda o objeto pelo caminho, e a foto trocada continuaria
     * servindo a antiga até uma invalidação que ninguém dispara.
     */
    const objectKey = `establishments/${input.establishment_id}/avatar/${randomUUID()}.${extension}`;

    await this.storage.putObject({
      object_key: objectKey,
      data: input.data,
      content_type: input.content_type,
    });

    const publicUrl = this.storage.getPublicUrl(objectKey) ?? objectKey;

    const previousKey = establishment.changeAvatar(publicUrl, objectKey);

    if (establishment.notification.hasErrors()) {
      throw new EntityValidationError(establishment.notification.toJSON());
    }

    await this.establishmentRepo.update(establishment);

    /*
     * A foto ANTERIOR só sai depois de a nova estar gravada, e a falha não
     * sobe — exatamente como na capa. Apagar antes deixaria a conversa com o
     * músico mostrando uma imagem quebrada se o `update` falhasse; relançar
     * transformaria uma troca que deu certo num erro na cara do dono.
     */
    if (previousKey) {
      await this.storage
        .deleteObject({ object_key: previousKey })
        .catch(() => undefined);
    }

    return EstablishmentOutputMapper.toOutput(establishment);
  }
}
