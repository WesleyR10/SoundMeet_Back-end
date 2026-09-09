import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";

import { VerifyContractUseCase } from "../../core/contract/application/use-cases/verify-contract/verify-contract.use-case";
import { Public } from "../auth-module";
import { ContractVerificationPresenter } from "./contract.presenter";

/**
 * Verificação pública de contrato por código.
 *
 * Serve a um terceiro com o PDF em mãos — o contador do bar, um advogado, o
 * gerente que recebeu o documento por e-mail. Devolve o suficiente para
 * conferir que aquele papel corresponde a um contrato real e íntegro, e nada
 * além: nomes mascarados, sem cláusula, sem valor, sem documento, sem endereço.
 *
 * Controller separado do `ContractsController` porque a classe inteira daquele
 * tem `@UseGuards(AuthGuard, ...)`. Um `@Public()` solto no meio de um
 * controller autenticado é o tipo de exceção que alguém remove sem perceber ao
 * refatorar — e aqui a exceção é o ponto.
 */
@ApiTags("Contracts")
@Controller("contracts/verify")
export class ContractVerificationController {
  @Inject(VerifyContractUseCase)
  private verifyUseCase: VerifyContractUseCase;

  @Get(":code")
  @Public()
  @ApiOperation({
    summary: "Verificar um contrato pelo código público",
    description:
      "Confirma existência, status e integridade. Compare o `content_hash` com o SHA-256 impresso no rodapé do documento: se divergir, o papel em mãos não é o contrato registrado.",
  })
  @ApiParam({
    name: "code",
    required: true,
    example: "SM7K2Q9XPT",
    description: "Código impresso no rodapé do documento.",
  })
  @ApiResponse({ status: 200, type: ContractVerificationPresenter })
  @ApiResponse({ status: 404, description: "Código não encontrado." })
  async verify(@Param("code") code: string) {
    const output = await this.verifyUseCase.execute({
      verification_code: code,
    });

    return new ContractVerificationPresenter(output);
  }
}
