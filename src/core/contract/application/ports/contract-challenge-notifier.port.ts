import { ContractPartyRole } from "../../domain/contract-types";

/**
 * Entrega do código de assinatura à parte.
 *
 * Porta separada de `IContractSignatureChallenge` de propósito: gerar e
 * entregar são responsabilidades distintas, e o adapter de entrega vive na
 * camada Nest (onde o `MailService` está), enquanto o de geração é puro cache.
 *
 * O destinatário vem do **snapshot congelado da parte** dentro do contrato,
 * nunca do cadastro atual nem do corpo da requisição: é o e-mail que a parte
 * tinha quando o instrumento foi emitido, e é o que a trilha vai declarar.
 */
export type SignatureChallengeNotification = {
  to: string;
  /** Nome da parte, como consta na qualificação do documento. */
  party_name: string;
  role: ContractPartyRole;
  code: string;
  expires_at: Date;
  verification_code: string;
};

export interface IContractChallengeNotifier {
  sendSignatureChallenge(input: SignatureChallengeNotification): Promise<void>;
}
