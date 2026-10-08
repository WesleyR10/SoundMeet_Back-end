import { ValueObject } from "../../../shared/domain/value-object";

/**
 * Nome começa com `Invalid` e termina com `Error` de propósito: o
 * `GlobalExceptionFilter` tem um ramo que mapeia exatamente esse formato de
 * nome para **422**. Sem isso, um áudio recusado viraria 500 genérico com
 * alerta no Sentry — regra de negócio contabilizada como defeito de servidor.
 */
export class InvalidPresentationAudioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPresentationAudioError";
  }
}

export type PresentationAudioJSON = {
  url: string;
  object_key: string;
  duration_seconds: number;
  uploaded_at: Date;
};

/**
 * Áudio de apresentação do músico — o trecho que o estabelecimento ouve antes
 * de contratar.
 *
 * 🔴 **Os quatro campos andam juntos por construção, e é essa a razão de o VO
 * existir.** `Musician.avatar` guarda só a URL, sem a chave do objeto: trocar a
 * foto deixa o arquivo anterior no bucket sem nada apontando para ele, pago
 * todo mês e invisível para sempre. Num áudio de 40s o arquivo pesa cem vezes
 * mais que um avatar, então o defeito sai cem vezes mais caro. `Establishment`
 * resolveu isso com o par `cover`/`cover_key`; aqui o par vira um VO, para que
 * seja **impossível** gravar a URL e esquecer a chave.
 *
 * A duração é guardada, e não recalculada na leitura, porque quem sabe medir é
 * o parser que rodou no upload — a tela precisa do "0:38" sem baixar o arquivo.
 */
export class PresentationAudio extends ValueObject {
  readonly url: string;
  readonly object_key: string;
  readonly duration_seconds: number;
  readonly uploaded_at: Date;

  constructor(props: {
    url: string;
    object_key: string;
    duration_seconds: number;
    uploaded_at?: Date;
  }) {
    super();

    const url = props.url?.trim() ?? "";
    const objectKey = props.object_key?.trim() ?? "";

    if (!url) {
      throw new InvalidPresentationAudioError(
        "Áudio de apresentação sem URL pública.",
      );
    }

    /*
     * 🔴 A URL tem que ser ABSOLUTA. Quando o storage não tem base pública
     * configurada, `getPublicUrl` devolve `null` e o padrão do avatar grava a
     * object key crua no campo de URL. Numa `<img>` isso dá ícone quebrado;
     * num `<audio src="musicians/...">` o browser resolve como caminho
     * RELATIVO à página que está aberta, pede
     * `/dashboard/artistas/musicians/...`, leva 404 e o player fica mudo — sem
     * erro para o músico, que já gastou o upload. Recusar aqui transforma um
     * silêncio em erro de configuração visível.
     */
    if (!/^https?:\/\//i.test(url)) {
      throw new InvalidPresentationAudioError(
        "Áudio de apresentação precisa de uma URL absoluta (http/https).",
      );
    }

    if (!objectKey) {
      throw new InvalidPresentationAudioError(
        "Áudio de apresentação sem a chave do objeto — sem ela o arquivo antigo nunca é apagado.",
      );
    }

    if (
      !Number.isFinite(props.duration_seconds) ||
      props.duration_seconds <= 0
    ) {
      throw new InvalidPresentationAudioError(
        "Duração do áudio de apresentação inválida.",
      );
    }

    this.url = url;
    this.object_key = objectKey;
    // Inteiro: a tela mostra "0:38", ninguém precisa de 37,84.
    this.duration_seconds = Math.round(props.duration_seconds);
    this.uploaded_at = props.uploaded_at ?? new Date();
  }

  toJSON(): PresentationAudioJSON {
    return {
      url: this.url,
      object_key: this.object_key,
      duration_seconds: this.duration_seconds,
      uploaded_at: this.uploaded_at,
    };
  }
}
