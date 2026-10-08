import { ContractIpSource } from "../../domain/contract-types";

/**
 * De onde vem a **evidência** de uma assinatura.
 *
 * A porta existe porque a evidência muda de origem conforme o mecanismo, não
 * porque "toda dependência merece uma interface":
 *
 * - **assinatura própria** (hoje) — a evidência é o que o nosso servidor
 *   observou: instante, IP, procedência do IP e user-agent da requisição em que
 *   o aceite foi manifestado;
 * - **provedor externo** (ZapSign, Clicksign, Autentique) — a evidência vem do
 *   provedor, com carimbo de tempo próprio e, opcionalmente, certificado
 *   ICP-Brasil. Nesse caso o instante e o IP relevantes **não são os nossos**,
 *   e usar os nossos seria registrar evidência errada.
 *
 * O que NÃO passa por aqui: nome e documento do signatário. Eles vêm do
 * snapshot congelado da parte, dentro do agregado — nunca de um provedor e
 * nunca do cliente.
 */

export type SignatureCaptureRequest = {
  contract_id: string;
  /** `sub` do JWT — a identidade autenticada que manifestou o aceite. */
  signer_user_id: string;
  /** O IP que o servidor enxergou nesta requisição. */
  observed_ip: string | null;
  /** `X-Forwarded-For` cru, sem interpretação. */
  forwarded_for: string | null;
  user_agent: string | null;
};

export type SignatureEvidence = {
  signed_at: Date;
  ip: string | null;
  ip_source: ContractIpSource;
  forwarded_for: string | null;
  user_agent: string | null;
};

export interface IContractSignatureProvider {
  captureSignature(
    request: SignatureCaptureRequest,
  ): Promise<SignatureEvidence>;
}
