import { Readable } from "node:stream";

/**
 * Storage do contrato — o primeiro arquivo **privado** do repositório.
 *
 * ## Por que esta porta não tem `getPublicUrl`
 *
 * As outras quatro portas de storage do projeto (`establishment`, `musician`,
 * `ai-cifra`, `ai-audio`) expõem `putObject`/`deleteObject`/`getPublicUrl`, e o
 * bucket é público: avatar e cardápio são feitos para serem vistos por
 * qualquer um. Não existe URL assinada em lugar nenhum do backend.
 *
 * Um contrato tem CPF, CNPJ, endereço residencial e valor de cachê. Num bucket
 * público, o que protege o arquivo é a imprevisibilidade da chave — o que é
 * segurança por obscuridade, não segurança. E bastaria alguém chamar
 * `getPublicUrl` "só para facilitar o download" para o vazamento existir.
 *
 * **A porta não oferece o método.** Não há como devolver uma URL pública porque
 * não há função que a produza: o vazamento por engano fica impossível por
 * construção, não por disciplina. O download passa por
 * `GET /contracts/:contract_id/document`, que autoriza e faz stream do objeto.
 */
export interface IContractStorage {
  putObject(input: {
    object_key: string;
    data: Buffer | Readable;
    content_type: string;
  }): Promise<void>;

  /**
   * Lê o objeto para stream autorizado.
   *
   * Devolve `null` quando a chave não existe — contrato cujo documento sumiu do
   * storage é problema operacional, não erro de programação, e a rota precisa
   * poder responder 404 em vez de 500.
   */
  getObject(input: { object_key: string }): Promise<{
    data: Readable;
    content_type: string;
    content_length: number | null;
  } | null>;

  deleteObject(input: { object_key: string }): Promise<void>;
}
