import { ContractPartyRole } from "../../domain/contract-types";

/**
 * Segundo fator da assinatura.
 *
 * ## Por que existe
 *
 * A conta autenticada prova que **alguém com a senha entrou**; não prova
 * **quem**. Contra um "usaram minha conta", a trilha oferecia IP, user-agent e
 * o e-mail confirmado do cadastro — razoável, mas fraco para um instrumento
 * cuja função é provar fatos. O código de uso único, enviado ao e-mail da parte
 * e exigido no ato, amarra a assinatura a quem tem acesso àquela caixa.
 *
 * É a medida de melhor custo/benefício das quatro levantadas na revisão
 * jurídica (`Docs/_privado/juridico/checklist-juridico-do-contrato.md` §4): resolve a fragilidade de
 * autoria sem coletar **dado biométrico**, que é dado pessoal sensível
 * (LGPD art. 5º, II) e elevaria o risco de vazamento de forma desproporcional
 * ao ganho.
 *
 * ## Por que a emissão e a entrega são portas separadas
 *
 * `issue` devolve o código para quem chamou; **quem entrega é o notificador**.
 * A separação existe para que o código nunca precise atravessar a camada de
 * infraestrutura de e-mail para ser gerado, e para que o teste do use-case
 * possa exercitar o fluxo inteiro sem mock de e-mail.
 *
 * 🔴 **O código NUNCA entra no output do use-case.** Ele vai para a caixa da
 * parte e mais nada — devolvê-lo na resposta HTTP anularia o segundo fator,
 * porque quem já tem o token da conta leria o código na própria resposta.
 */
export type SignatureChallengeKey = {
  contract_id: string;
  role: ContractPartyRole;
  signer_user_id: string;
};

export type IssuedSignatureChallenge = {
  /** 🔴 Só para entrega. Nunca serializar em resposta HTTP nem em log. */
  code: string;
  expires_at: Date;
};

export interface IContractSignatureChallenge {
  /**
   * Emite um código novo, invalidando qualquer anterior da mesma chave —
   * reemitir é o caminho de quem não recebeu o primeiro, e dois códigos vivos
   * ao mesmo tempo dobrariam a superfície de tentativa.
   */
  issue(key: SignatureChallengeKey): Promise<IssuedSignatureChallenge>;

  /**
   * Confere e **consome**. Um código vale uma vez: sucesso o apaga, para que
   * uma resposta HTTP capturada não possa ser repetida.
   *
   * Lança `InvalidSignatureChallengeError` quando o código não existe, expirou,
   * não confere ou o limite de tentativas foi atingido — sem distinguir os
   * casos na mensagem, porque a distinção ajudaria quem está tentando adivinhar.
   */
  consume(key: SignatureChallengeKey, code: string): Promise<void>;
}

export class InvalidSignatureChallengeError extends Error {
  constructor(message?: string) {
    super(message ?? "Código de assinatura inválido ou expirado");
    this.name = "InvalidSignatureChallengeError";
  }
}
