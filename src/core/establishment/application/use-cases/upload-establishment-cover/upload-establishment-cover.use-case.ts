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
 * 4 MB, e não os 5 MB do avatar e do cardápio.
 *
 * A capa é a imagem mais larga do produto e a que mais gente baixa: ela abre
 * no painel do dono E na página pública do local, que é indexada. Um JPEG de
 * 1600×600 bem exportado fica entre 150 e 400 KB; 4 MB já é folga generosa
 * para quem manda a foto direto da câmera do celular sem tratar.
 */
const DEFAULT_MAX_FILE_SIZE = 4 * 1024 * 1024;

/**
 * ⚠️ Os valores são o vocabulário do `file-type`, não o do `Content-Type` do
 * cliente — o controller detecta o MIME pelos BYTES e entrega o resultado
 * aqui. `image/jpg` não existe nesta lista de propósito: o detector devolve
 * `image/jpeg` para os dois, e aceitar o apelido daria a impressão de que a
 * allowlist cobre algo que ela nunca vê.
 */
const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type UploadEstablishmentCoverInput = {
  establishment_id: string;
  data: Buffer | Readable;
  content_type: string;
  file_size: number;
};

export type UploadEstablishmentCoverOutput = EstablishmentOutput;

export class UploadEstablishmentCoverUseCase implements IUseCase<
  UploadEstablishmentCoverInput,
  UploadEstablishmentCoverOutput
> {
  constructor(
    private readonly establishmentRepo: IEstablishmentRepository,
    private readonly storage: IEstablishmentStorage,
  ) {}

  async execute(
    input: UploadEstablishmentCoverInput,
  ): Promise<UploadEstablishmentCoverOutput> {
    const maxSize = Number(
      process.env.ESTABLISHMENT_COVER_MAX_SIZE ?? DEFAULT_MAX_FILE_SIZE,
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
     * Chave nova a cada upload (UUID), nunca `cover.jpg` fixo.
     *
     * 🔴 Sobrescrever a mesma chave pareceria mais limpo e quebraria o CDN: o
     * CloudFront guarda o objeto pelo caminho, e a capa trocada continuaria
     * servindo a antiga até a invalidação — que custa dinheiro e que ninguém
     * dispara. Com chave nova, a URL muda junto e o cache velho morre sozinho.
     */
    const objectKey = `establishments/${input.establishment_id}/cover/${randomUUID()}.${extension}`;

    await this.storage.putObject({
      object_key: objectKey,
      data: input.data,
      content_type: input.content_type,
    });

    const publicUrl = this.storage.getPublicUrl(objectKey) ?? objectKey;

    const previousKey = establishment.changeCover(publicUrl, objectKey);

    if (establishment.notification.hasErrors()) {
      throw new EntityValidationError(establishment.notification.toJSON());
    }

    await this.establishmentRepo.update(establishment);

    /*
     * ⚠️ A capa ANTIGA só sai depois de a nova estar gravada, e a falha não
     * sobe.
     *
     * A ordem é o ponto: apagar antes de persistir deixaria o registro
     * apontando para um objeto que já não existe se o `update` falhasse — capa
     * quebrada na página pública, que é pior do que um arquivo a mais no
     * bucket. E relançar aqui transformaria "a capa foi trocada com sucesso,
     * mas a faxina falhou" num erro na cara do dono, sobre uma operação que
     * já deu certo.
     */
    if (previousKey) {
      await this.storage
        .deleteObject({ object_key: previousKey })
        .catch(() => undefined);
    }

    return EstablishmentOutputMapper.toOutput(establishment);
  }
}
