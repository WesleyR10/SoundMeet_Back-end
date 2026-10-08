import { IClock } from "../../../shared/application/clock.interface";
import {
  IContractSignatureProvider,
  SignatureCaptureRequest,
  SignatureEvidence,
} from "../../application/ports/contract-signature-provider.port";
import { ContractIpSource } from "../../domain/contract-types";

/**
 * Assinatura eletrônica própria — a evidência é o que o nosso servidor observou.
 *
 * Válida entre as partes pela MP 2.200-2/2001, art. 10, §2º, **desde que** o
 * contrato contenha a cláusula de reconhecimento — que é `required` no catálogo
 * exatamente por isso.
 *
 * ## 🔴 A honestidade sobre o IP
 *
 * Todo o `soundmeet-web` sai de um IP só (é o mesmo fato que causa o item
 * aberto de rate limit do `roadmap-backend.md` §9.7). Registrar o IP do BFF como "IP do
 * signatário" seria evidência falsa — e evidência que exagera é evidência que o
 * outro lado derruba com uma pergunta.
 *
 * Este provider **não tenta adivinhar** o IP real a partir do
 * `X-Forwarded-For`: confiar nesse cabeçalho exige saber exatamente quantos
 * proxies existem na frente, e errar essa conta é como se falsifica origem. Em
 * vez disso ele registra o que viu, guarda a cadeia crua sem interpretá-la, e
 * **marca a procedência** — que é o que permite ao certificado dizer "por proxy
 * da plataforma" em vez de afirmar uma origem que não conhece.
 */
export class InternalContractSignatureProvider implements IContractSignatureProvider {
  constructor(private readonly clock: IClock = { now: () => new Date() }) {}

  async captureSignature(
    request: SignatureCaptureRequest,
  ): Promise<SignatureEvidence> {
    return {
      signed_at: this.clock.now(),
      ip: request.observed_ip,
      ip_source: this.resolveIpSource(request),
      forwarded_for: request.forwarded_for,
      user_agent: request.user_agent,
    };
  }

  private resolveIpSource(request: SignatureCaptureRequest): ContractIpSource {
    if (!request.observed_ip) return "unknown";
    // A presença de `X-Forwarded-For` é o único sinal honesto de que existe
    // intermediário: o IP observado é o do último salto, não o do signatário.
    return request.forwarded_for ? "proxied" : "direct";
  }
}
