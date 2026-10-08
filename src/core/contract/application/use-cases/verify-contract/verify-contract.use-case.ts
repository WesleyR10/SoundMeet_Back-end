import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Contract } from "../../../domain/contract.aggregate";
import { IContractRepository } from "../../../domain/contract.repository";
import {
  ContractOutputMapper,
  ContractVerificationOutput,
} from "../common/contract-output";

export type VerifyContractInput = {
  verification_code: string;
};

/**
 * Verificação pública por código — a rota `@Public()`.
 *
 * ## O que ela entrega, e por quê
 *
 * Serve a quem tem o PDF em mãos e quer saber se aquilo é real: devolve
 * `status`, datas, `content_hash` e os nomes **mascarados** das partes. Quem
 * segura o documento reconhece as partes e confere o hash impresso no rodapé;
 * quem só tem o código não colhe nome completo, CPF, endereço, valor nem
 * cláusula de ninguém.
 *
 * Allowlist campo a campo em `toVerificationOutput`, nunca omissão dos
 * sensíveis — regra do projeto, precedente `PublicMusicLibraryItemPresenter`.
 *
 * ## Por que o hash publicado tem valor
 *
 * Porque o mapper **recusa carregar** um contrato cujo conteúdo não bata com o
 * hash gravado. Sem essa checagem na carga, publicar o hash seria decoração: um
 * contrato adulterado no banco continuaria sendo servido, com o hash antigo do
 * lado.
 */
export class VerifyContractUseCase implements IUseCase<
  VerifyContractInput,
  ContractVerificationOutput
> {
  constructor(private readonly contractRepo: IContractRepository) {}

  async execute(
    input: VerifyContractInput,
  ): Promise<ContractVerificationOutput> {
    const code = input.verification_code?.trim().toUpperCase() ?? "";

    const contract = code
      ? await this.contractRepo.findByVerificationCode(code)
      : null;

    if (!contract) {
      // 404 e não uma resposta "inválido": a rota é pública e enumerável, e
      // responder de forma diferente para código inexistente x código anulado
      // já seria um oráculo. Todo código desconhecido responde igual.
      throw new NotFoundError(code, Contract);
    }

    return ContractOutputMapper.toVerificationOutput(contract);
  }
}
