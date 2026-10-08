import { Band, BandId } from "@core/musician/domain/band.aggregate";
import { IBandRepository } from "@core/musician/domain/band.repository";
import {
  MusicianWallet,
  PaymentMethod,
  Tip,
  TipId,
  Transaction,
} from "@core/payment";
import {
  IMusicianWalletRepository,
  ITipRepository,
  ITransactionRepository,
} from "@core/payment/domain/repositories";
import { TipStatus } from "@core/payment/domain/tip-enums";
import { TransactionType } from "@core/payment/domain/transaction-enums";
import { IUseCase } from "@core/shared/application/use-case.interface";
import { NotFoundError } from "@core/shared/domain/errors";
import { DomainEventMediator } from "@core/shared/domain/events/domain-event-mediator";
import { IUnitOfWork } from "@core/shared/domain/repository/unit-of-work.interface";
import { EntityValidationError } from "@core/shared/domain/validators/validation.error";

/**
 * Onde o dinheiro efetivamente caiu.
 *
 * - `"beneficiary"` — liquidou **direto na conta do músico** (split do Mercado
 *   Pago). A plataforma nunca teve o valor.
 * - `"platform"` — entrou na conta da plataforma, que deve ao músico. É o
 *   modelo antigo (gateway único) e o do mock de desenvolvimento.
 */
export type TipSettlement = "beneficiary" | "platform";

export type ConfirmTipPaymentInput = {
  tip_id: string;
  /**
   * 🔴 **Obrigatório e sem default.** Errar aqui custa dinheiro real: marcar
   * como `"platform"` uma gorjeta que liquidou na conta do músico cria saldo
   * sacável de dinheiro que a plataforma nunca recebeu — e o saque sai do
   * caixa dela. Obrigatório força cada webhook novo a declarar a procedência
   * em vez de herdar um default silencioso.
   */
  settlement: TipSettlement;
  payment: {
    amount: number;
    fee?: number;
    payment_method: PaymentMethod;
    user_id?: string | null;
    /** ID do pagamento no gateway. Vira `transactions.externalId` (UNIQUE). */
    external_id?: string | null;
    metadata?: Record<string, any> | null;
  };
};

export type ConfirmTipPaymentOutput = {
  tip_id: string;
  transaction_id: string;
  wallet_balance: number;
};

export class ConfirmTipPaymentUseCase implements IUseCase<
  ConfirmTipPaymentInput,
  ConfirmTipPaymentOutput
> {
  constructor(
    private readonly tipRepo: ITipRepository,
    private readonly txRepo: ITransactionRepository,
    private readonly walletRepo: IMusicianWalletRepository,
    private readonly bandRepo: IBandRepository,
    private readonly uow: IUnitOfWork,
    private readonly domainEventMediator: DomainEventMediator,
  ) {}

  async execute(
    input: ConfirmTipPaymentInput,
  ): Promise<ConfirmTipPaymentOutput> {
    const { tip, ...output } = await this.uow.do(() => this.confirm(input));

    await this.domainEventMediator.publish(tip);
    await this.domainEventMediator.publishIntegrationEvents(tip);

    return output;
  }

  private async confirm(
    input: ConfirmTipPaymentInput,
  ): Promise<{ tip: Tip } & ConfirmTipPaymentOutput> {
    const tip = await this.tipRepo.findById(new TipId(input.tip_id));
    if (!tip) {
      throw new NotFoundError(input.tip_id, Tip);
    }

    // Segunda barreira de idempotência, dentro da transação: mesmo que o ledger
    // de eventos libere uma reentrega (retomada após crash, chaves distintas
    // para o mesmo pagamento), uma gorjeta já concluída nunca credita de novo.
    if (tip.status === TipStatus.COMPLETED) {
      return {
        tip,
        tip_id: tip.tip_id.id,
        transaction_id: tip.transaction_id ?? "",
        wallet_balance: await this.currentBalance(tip),
      };
    }

    const transaction = Transaction.create({
      user_id: input.payment.user_id ?? null,
      musician_id: tip.musician_id?.id ?? null,
      band_id: tip.band_id?.id ?? null,
      type: TransactionType.TIP,
      amount: input.payment.amount,
      fee: input.payment.fee ?? 0,
      payment_method: input.payment.payment_method,
      external_id: input.payment.external_id ?? null,
      metadata: input.payment.metadata ?? null,
    });

    await this.txRepo.insert(transaction);

    tip.complete(transaction.transaction_id.id);

    if (tip.notification.hasErrors()) {
      throw new EntityValidationError(tip.notification.toJSON());
    }
    await this.tipRepo.update(tip);

    if (tip.band_id) {
      const band = await this.bandRepo.findById(new BandId(tip.band_id.id));
      if (!band) {
        throw new NotFoundError(tip.band_id.id, Band);
      }

      const activeMembers = band.acceptedMembers;
      if (activeMembers.length > 0) {
        /*
         * Divisão igualitária entre os membros aceitos.
         * Futuro: percentuais customizáveis, conforme os requisitos.
         *
         * 🔴 `allocate` em vez de `Math.floor(net / n)`, e a diferença é
         * dinheiro de verdade. O cálculo anterior era em REAIS, tratando
         * centavos como resto descartável:
         *
         *   - R$30,00 entre 4 membros dava R$9 ao primeiro e R$7 a cada um dos
         *     outros. O justo é R$7,50 — o líder levava R$1,50 a mais, tirados
         *     dos colegas, e a soma fechava, então nada denunciava o desvio.
         *   - R$18,20 entre 3 produzia `6.199999999999999`, que o `Money`
         *     recusa: a confirmação da gorjeta falhava INTEIRA, com o pagamento
         *     já aprovado no gateway e o dinheiro sem destino.
         *
         * `allocate` reparte em centavos, distribui o resto de um em um e
         * garante que a soma das quotas é exatamente o líquido — nenhum centavo
         * criado, nenhum perdido.
         */
        const shares = transaction.net_amount.allocate(activeMembers.length);

        for (let i = 0; i < activeMembers.length; i++) {
          const member = activeMembers[i];
          const share = shares[i].amount;

          if (share > 0) {
            let memberWallet = await this.walletRepo.findByMusicianId(
              member.musician_id.id,
            );
            if (!memberWallet) {
              memberWallet = MusicianWallet.create({
                musician_id: member.musician_id.id,
              });
              await this.walletRepo.insert(memberWallet);
            }

            this.creditWallet(memberWallet, share, input.settlement);

            if (memberWallet.notification.hasErrors()) {
              throw new EntityValidationError(
                memberWallet.notification.toJSON(),
              );
            }
            await this.walletRepo.update(memberWallet);

            // Create individual transaction record for member share
            const memberTx = Transaction.create({
              musician_id: member.musician_id.id,
              band_id: band.band_id.id,
              type: TransactionType.TIP, // Or a specific type like TIP_SHARE
              amount: share,
              fee: 0, // Fee already deducted from main transaction
              payment_method: input.payment.payment_method,
              metadata: {
                parent_transaction_id: transaction.transaction_id.id,
                tip_id: tip.tip_id.id,
                is_split: true,
              },
            });
            await this.txRepo.insert(memberTx);
          }
        }
      } else {
        throw new EntityValidationError([
          { band_id: ["Band has no active members to receive tip funds"] },
        ]);
      }
    } else {
      // Direct musician tip
      if (!tip.musician_id) {
        throw new EntityValidationError([
          {
            musician_id: [
              "musician_id is required when band_id is not present",
            ],
          },
        ]);
      }

      let wallet = await this.walletRepo.findByMusicianId(tip.musician_id.id);
      if (!wallet) {
        wallet = MusicianWallet.create({ musician_id: tip.musician_id.id });
        await this.walletRepo.insert(wallet);
      }

      this.creditWallet(
        wallet,
        transaction.net_amount.amount,
        input.settlement,
      );

      if (wallet.notification.hasErrors()) {
        throw new EntityValidationError(wallet.notification.toJSON());
      }
      await this.walletRepo.update(wallet);
    }

    return {
      tip,
      tip_id: tip.tip_id.id,
      transaction_id: transaction.transaction_id.id,
      wallet_balance: await this.currentBalance(tip),
    };
  }

  // Saldo do destinatário principal (músico). Em gorjeta de banda o valor é
  // rateado entre as carteiras dos membros, então não há saldo único a exibir.
  /**
   * Credita a carteira conforme **onde o dinheiro caiu**.
   *
   * 🔴 A distinção é a diferença entre registrar um ganho e prometer um saque.
   * Numa gorjeta liquidada na conta do músico (split do Mercado Pago), o valor
   * já é dele — `balance` só cresce quando a plataforma de fato detém o
   * dinheiro e o deve a ele.
   */
  private creditWallet(
    wallet: MusicianWallet,
    amount: number,
    settlement: TipSettlement,
  ): void {
    if (settlement === "beneficiary") {
      wallet.recordExternalEarning(amount);
      return;
    }

    wallet.receiveFunds(amount);
  }

  private async currentBalance(tip: Tip): Promise<number> {
    if (!tip.musician_id) {
      return 0;
    }
    const wallet = await this.walletRepo.findByMusicianId(tip.musician_id.id);
    return wallet ? wallet.balance.amount : 0;
  }
}
