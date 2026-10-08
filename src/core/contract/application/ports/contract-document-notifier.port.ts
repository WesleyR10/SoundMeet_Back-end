import { ContractPartyRole } from "../../domain/contract-types";

/**
 * Entrega do contrato às partes, com o PDF anexo.
 *
 * ## Por que o e-mail importa, e não é só cortesia
 *
 * **Prova fora do nosso controle.** Enquanto o documento existe apenas no nosso
 * storage e a trilha apenas no nosso banco, somos parte interessada guardando
 * a própria prova — a fragilidade registrada em
 * `Docs/_privado/juridico/checklist-juridico-do-contrato.md` §4. Uma cópia na caixa de cada parte, com
 * o carimbo de data do provedor de e-mail, é a primeira evidência que não
 * depende de acreditar em nós.
 *
 * **Camada 4 de proteção contra chargeback**
 * (`Docs/_privado/pagamentos/decisoes-de-gateway.md`): trail documental independente,
 * recebido pelo e-mail corporativo do estabelecimento.
 *
 * **O que o usuário pediu:** que as três partes — contratante, contratado e
 * SoundMeet — fiquem com cópia do instrumento assinado.
 *
 * ## O hash vai no corpo, não só no PDF
 *
 * Quem recebe consegue conferir o documento na página pública de verificação
 * sem depender do que está impresso dentro do próprio arquivo que se quer
 * conferir. Hash impresso apenas no PDF prova pouco: se o PDF foi adulterado, o
 * hash dentro dele foi junto.
 */
export type ContractDocumentMoment = "issued" | "signed";

export type ContractDocumentNotification = {
  to: string;
  party_name: string;
  role: ContractPartyRole;
  moment: ContractDocumentMoment;
  /** Nome da outra parte, para o corpo do e-mail dizer com quem é o contrato. */
  counterparty_name: string;
  verification_code: string;
  verification_url: string;
  content_hash: string;
  show_date: string;
  local_name: string;
  fee_formatted: string;
  document: {
    filename: string;
    content: Buffer;
  };
};

export interface IContractDocumentNotifier {
  /**
   * 🔴 **Deve propagar erro de envio.**
   *
   * O `MailService.send` privado engole a falha e apenas loga — comportamento
   * certo para um "bem-vindo", errado aqui: o contrato "sumiria" em silêncio e
   * ninguém saberia que a cópia independente nunca existiu. Quem chama decide o
   * que fazer com a falha, e o reenvio manual existe por causa disso.
   */
  sendContractDocument(input: ContractDocumentNotification): Promise<void>;
}
