import { ContractPartyJSON } from "../../domain/value-objects/contract-party.vo";
import { ContractSignatureJSON } from "../../domain/value-objects/contract-signature.vo";
import { ContractVariablesJSON } from "../../domain/value-objects/contract-variables.vo";
import { RenderedClauseJSON } from "../../domain/value-objects/rendered-clause.vo";

/**
 * Renderização do documento.
 *
 * O domínio não conhece PDF. A porta devolve bytes e um `content_type`
 * genérico de propósito: se o adapter de PDF brigar com o `module: "commonjs"`
 * do projeto, a mesma fatia entrega o contrato como HTML no storage privado e o
 * adapter de PDF entra depois **sem tocar em domínio, use case, storage ou UI**.
 * A porta transforma um risco de cronograma em troca de adapter.
 *
 * É também o ponto de extensão para um provedor externo de assinatura
 * (ZapSign/Clicksign), que renderiza e assina no mesmo passo.
 */

export type ContractRenderInput = {
  template_version: string;
  template_title: string;
  contractor: ContractPartyJSON;
  contracted: ContractPartyJSON;
  variables: ContractVariablesJSON;
  clauses: RenderedClauseJSON[];
  /*
   * ⚠️ **Não existe campo `stage_tech_spec` aqui, e a ausência é a correção.**
   *
   * Até 16/ago/2026 o Anexo I chegava por este caminho, lido do perfil VIVO do
   * estabelecimento — fora do snapshot e, portanto, fora do `content_hash`. Duas
   * emissões do mesmo contrato com a ficha editada entre elas produziam
   * documentos diferentes com o MESMO hash, enquanto a cláusula
   * `estrutura_tecnica.com_anexo` transforma "item declarado no Anexo I" em
   * inadimplemento: a única parte do documento fora da verificação de
   * integridade era justamente a que cria obrigação.
   *
   * O anexo agora é `variables.ficha_tecnica_anexo`, congelado com o resto. Não
   * reintroduzir um campo paralelo — duas fontes para o mesmo conteúdo é
   * exatamente o que permitiu a divergência.
   */
  content_hash: string;
  verification_code: string;
  verification_url: string;
  issued_at: Date;
};

export type ContractCertificateRenderInput = ContractRenderInput & {
  signatures: ContractSignatureJSON[];
  signed_at: Date;
};

export type RenderedDocument = {
  data: Buffer;
  content_type: string;
  /** Extensão do arquivo, sem ponto — usada para montar a chave no storage. */
  file_extension: string;
};

export interface IContractRenderer {
  /** Anexo I incluído. É o documento que as partes assinam. */
  renderContract(input: ContractRenderInput): Promise<RenderedDocument>;

  /**
   * Anexo II — certificado de assinatura.
   *
   * Documento **separado**, gerado só depois que as duas partes assinaram. É o
   * que preserva a imutabilidade do contrato: a trilha de auditoria não pode
   * ser embutida num arquivo que já foi assinado sem reescrevê-lo. Clicksign e
   * DocuSign fazem igual.
   */
  renderSignatureCertificate(
    input: ContractCertificateRenderInput,
  ): Promise<RenderedDocument>;
}
