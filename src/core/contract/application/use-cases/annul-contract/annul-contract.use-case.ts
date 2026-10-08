import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Contract, ContractId } from "../../../domain/contract.aggregate";
import { IContractRepository } from "../../../domain/contract.repository";
import {
  ContractOutput,
  ContractOutputMapper,
} from "../common/contract-output";

export type AnnulContractInput = {
  contract_id: string;
  reason: string;
};

/**
 * Anulação administrativa de contrato ainda não assinado por ambas as partes.
 *
 * 🔴 **Não existe autorização de participante aqui — é rota de admin.** E o
 * agregado recusa anular contrato `signed`: contrato assinado é prova, e anular
 * apagaria justamente a evidência que ele existe para produzir. Show cancelado
 * depois de assinado permanece com o contrato assinado; o cancelamento é fato
 * do `Booking`.
 *
 * O caso de uso real é estreito e vale registrar: contrato emitido com dado
 * errado (cachê digitado errado no booking, endereço trocado) antes de alguém
 * assinar. Anulado libera a emissão de um novo para o mesmo booking, porque
 * `findCurrentByBookingId` ignora anulados.
 */
export class AnnulContractUseCase implements IUseCase<
  AnnulContractInput,
  ContractOutput
> {
  constructor(
    private readonly contractRepo: IContractRepository,
    private readonly clock: IClock = { now: () => new Date() },
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: AnnulContractInput): Promise<ContractOutput> {
    const contract = await this.contractRepo.findById(
      new ContractId(input.contract_id),
    );

    if (!contract) {
      throw new NotFoundError(input.contract_id, Contract);
    }

    contract.annul(input.reason, this.clock.now());

    if (contract.notification.hasErrors()) {
      throw new EntityValidationError(contract.notification.toJSON());
    }

    await this.contractRepo.update(contract);

    if (this.domainEventMediator) {
      await this.domainEventMediator.publish(contract);
      contract.clearEvents();
    }

    return ContractOutputMapper.toOutput(contract);
  }
}
