import { BookingId } from "../../../../scheduling/domain/booking.aggregate";
import { IBookingRepository } from "../../../../scheduling/domain/booking.repository";
import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { BookingStatusEnum } from "../../../../shared/domain/value-objects/booking-status.vo";
import { BookingEscrow } from "../../../domain/booking-escrow.aggregate";
import { BOOKING_ESCROW_DUE_HOURS_BEFORE_SHOW } from "../../../domain/booking-escrow-policy";
import { IBookingEscrowRepository } from "../../../domain/repositories/booking-escrow.repository";
import { IMusicianWalletRepository } from "../../../domain/repositories/musician-wallet.repository";
import { IBookingEscrowGateway } from "../../../infra/gateways/booking-escrow-gateway.interface";
import { buildEscrowReference } from "../common/booking-escrow-external-reference";

export type CreateBookingEscrowInput = {
  booking_id: string;
};

/**
 * Espelha o desenho de `IssueContractUseCase`: quando não dá para criar a
 * custódia, isso **não é exceção** — é o estado do cadastro ou do booking, e o
 * chamador precisa da chave para agir. Lançar aqui transformaria "o músico ainda
 * não tem subconta" em erro de sistema.
 */
export type CreateBookingEscrowOutput =
  | {
      created: true;
      escrow_id: string;
      amount: number;
      platform_fee: number;
      net_amount: number;
      already_existed: boolean;
      /**
       * 🔴 A garantia está mesmo ativa no provedor?
       *
       * `false` significa que a cobrança foi criada **sem custódia** — o
       * dinheiro cairá liberado na subconta do músico assim que for pago,
       * enquanto o contrato assinado afirma que ficaria retido. É a única
       * divergência deste fluxo capaz de transformar cláusula assinada em
       * declaração falsa, então ela sobe para o chamador em vez de virar um
       * campo nulo que ninguém lê.
       */
      guarantee_active: boolean;
    }
  | { created: false; reason: CreateBookingEscrowSkipReason };

export type CreateBookingEscrowSkipReason =
  | "booking_not_found"
  | "booking_not_confirmed"
  | "no_fee"
  | "no_musician"
  | "wallet_not_found"
  | "no_subaccount"
  | "escrow_disabled";

/**
 * Resolve a comissão da plataforma sobre o cachê, a partir do plano do músico.
 *
 * Porta estreita de propósito — o mesmo desenho de `EscrowReleaseDaysResolver`:
 * o pagamento não passa a depender da superfície inteira de planos só para ler
 * um número. `PlanCheckService` a satisfaz por tipagem estrutural.
 */
export type BookingFeeResolver = {
  getMusicianBookingFeePercentage(musician_id: string): Promise<number>;
};

export type CreateBookingEscrowDeps = {
  escrowRepo: IBookingEscrowRepository;
  bookingRepo: IBookingRepository;
  walletRepo: IMusicianWalletRepository;
  gateway: IBookingEscrowGateway;
  planResolver: BookingFeeResolver;
  clock?: IClock;
};

/**
 * Cria a custódia do cachê quando o show é confirmado (F1.3a).
 *
 * ## A ordem, e por que ela é esta
 *
 * 1. **Persistir a custódia em `pending` ANTES de falar com o provedor.** O
 *    `externalReference` da cobrança é o próprio `escrow_id`, então o registro
 *    precisa existir antes de a cobrança existir — senão o webhook do pagamento
 *    chegaria antes do que ele referencia, e o dinheiro entraria sem ninguém
 *    para reconciliar.
 * 2. **Criar a cobrança no provedor.**
 * 3. **Gravar a referência devolvida** (`attachCharge`).
 *
 * Falhar entre 1 e 2 deixa uma custódia `pending` sem cobrança — reexecutável e
 * inofensiva, porque nada foi cobrado de ninguém. O inverso (cobrar primeiro,
 * registrar depois) deixaria uma cobrança real sem registro local: dinheiro
 * bloqueado na subconta que nenhum job encontraria para liberar.
 *
 * 🔴 **`held_balance` NÃO é tocado aqui.** A cobrança foi criada, não paga.
 * Somar ao retido neste ponto anunciaria ao músico um valor que o
 * estabelecimento ainda pode simplesmente não pagar. Quem move o espelho é o
 * webhook, em `MarkBookingEscrowHeldUseCase`.
 */
export class CreateBookingEscrowUseCase implements IUseCase<
  CreateBookingEscrowInput,
  CreateBookingEscrowOutput
> {
  private readonly clock: IClock;

  constructor(private readonly deps: CreateBookingEscrowDeps) {
    this.clock = deps.clock ?? { now: () => new Date() };
  }

  async execute(
    input: CreateBookingEscrowInput,
  ): Promise<CreateBookingEscrowOutput> {
    /*
     * Idempotência primeiro: `bookingId` é `@unique` no banco, mas o evento é
     * reentregue (retomada após crash, dupla confirmação) e cobrar duas vezes o
     * mesmo show é o pior erro possível deste fluxo.
     *
     * ⚠️ A condição de parada é ter **cobrança no provedor**, não apenas existir
     * o registro. Uma custódia sem `external_id` é uma execução que morreu entre
     * o insert e a chamada ao provedor: parar aqui a deixaria `pending` para
     * sempre, sem ninguém nunca receber o pedido de pagamento — o show
     * aconteceria sem cachê custodiado e sem nenhum erro visível.
     */
    const existing = await this.deps.escrowRepo.findByBookingId(
      input.booking_id,
    );
    if (existing?.external_id) {
      return {
        created: true,
        already_existed: true,
        escrow_id: existing.escrow_id.id,
        amount: existing.amount.amount,
        platform_fee: existing.platform_fee.amount,
        net_amount: existing.net_amount.amount,
        // `expires_at` foi gravado por `attachCharge` na criação original.
        guarantee_active: existing.expires_at !== null,
      };
    }

    const booking = await this.deps.bookingRepo.findById(
      new BookingId(input.booking_id),
    );
    if (!booking) return { created: false, reason: "booking_not_found" };

    if (booking.status.value !== BookingStatusEnum.CONFIRMED) {
      return { created: false, reason: "booking_not_confirmed" };
    }

    /*
     * Show sem cachê acordado (permuta, casa própria) não tem o que custodiar.
     *
     * O corte é R$1, não R$0: `BookingEscrowValidator` exige `@Min(1)` em
     * `amount`, então um cachê de R$0,50 passaria daqui e explodiria como erro
     * de validação lá na frente — virando `escrow.create.failed` no log quando
     * na verdade é só um show sem valor a custodiar.
     */
    if (!booking.fee || booking.fee < 1) {
      return { created: false, reason: "no_fee" };
    }

    /*
     * Custódia de banda ainda não tem beneficiário resolvido: o split entre
     * membros é manual no MVP e a subconta é individual. Criar a cobrança
     * apontando para o líder faria o cachê da banda inteira entrar como dele.
     */
    if (!booking.musician_id) {
      return { created: false, reason: "no_musician" };
    }

    const wallet = await this.deps.walletRepo.findByMusicianId(
      booking.musician_id.id,
    );
    if (!wallet) return { created: false, reason: "wallet_not_found" };
    if (!wallet.hasSubaccount)
      return { created: false, reason: "no_subaccount" };

    /*
     * A Conta Escrow custa por subconta habilitada, então nem toda carteira tem
     * uma. Sem ela o provedor cria uma cobrança COMUM — o dinheiro cairia
     * liberado na subconta, sem garantia nenhuma, enquanto o contrato afirma
     * custódia. Fail-safe: não cria.
     */
    if (!wallet.escrow_enabled) {
      return { created: false, reason: "escrow_disabled" };
    }

    /*
     * Retomada: a custódia nasceu numa execução anterior que morreu antes de
     * criar a cobrança. Reaproveita o registro — `bookingId` é `@unique`, então
     * um segundo insert falharia, e recriar o agregado descongelaria a taxa que
     * já tinha sido travada para este show.
     */
    const escrow =
      existing ??
      (await this.buildEscrow({
        booking_id: input.booking_id,
        musician_id: booking.musician_id.id,
        amount: booking.fee,
      }));

    if (!existing) {
      await this.deps.escrowRepo.insert(escrow);
    }

    const reference = buildEscrowReference(escrow.escrow_id.id);

    /*
     * 🔴 Procura antes de criar — a janela em que a cobrança já existe no
     * provedor mas o `external_id` ainda não foi gravado é indistinguível, no
     * banco, de "nunca cobramos". Sem esta consulta, a retomada emitiria um
     * SEGUNDO PIX para o mesmo show, e o estabelecimento poderia pagar os dois.
     */
    const charge =
      (await this.deps.gateway.findChargeByReference(reference)) ??
      (await this.deps.gateway.createEscrowCharge({
        beneficiary_wallet_id: wallet.asaas_wallet_id!,
        amount: escrow.amount.amount,
        platform_fee: escrow.platform_fee.amount,
        net_amount: escrow.net_amount.amount,
        external_reference: reference,
        description: "Cachê de apresentação — SoundMeet",
        due_date: this.dueDate(booking.start_at),
      }));

    escrow.attachCharge({
      external_id: charge.external_id,
      expires_at: charge.expires_at,
      at: this.clock.now(),
    });

    if (escrow.notification.hasErrors()) {
      throw new EntityValidationError(escrow.notification.toJSON());
    }

    await this.deps.escrowRepo.update(escrow);

    return {
      created: true,
      already_existed: false,
      escrow_id: escrow.escrow_id.id,
      amount: escrow.amount.amount,
      platform_fee: escrow.platform_fee.amount,
      net_amount: escrow.net_amount.amount,
      /*
       * O provedor só devolve data de expiração da garantia quando a Conta
       * Escrow está de fato ativa na subconta. Ausente = cobrança comum, sem
       * retenção — `wallet.escrow_enabled` é só o nosso espelho e pode estar
       * desatualizado em relação ao que o provedor realmente fará.
       */
      guarantee_active: charge.expires_at !== null,
    };
  }

  /**
   * A taxa vem do PLANO, resolvida agora e **congelada** no agregado.
   *
   * Ler no ato da criação (e não na liberação) é o que faz um reajuste
   * posterior não alcançar show já contratado — a mesma âncora de data que a
   * cláusula do contrato pressupõe.
   */
  private async buildEscrow(params: {
    booking_id: string;
    musician_id: string;
    amount: number;
  }): Promise<BookingEscrow> {
    const feePercentage =
      await this.deps.planResolver.getMusicianBookingFeePercentage(
        params.musician_id,
      );

    const escrow = BookingEscrow.create({
      booking_id: params.booking_id,
      musician_id: params.musician_id,
      amount: params.amount,
      platform_fee_percentage: feePercentage,
    });

    if (escrow.notification.hasErrors()) {
      throw new EntityValidationError(escrow.notification.toJSON());
    }

    return escrow;
  }

  /**
   * Vencimento da cobrança: 48h antes do show.
   *
   * Show confirmado em cima da hora tem vencimento no passado, o que o provedor
   * recusaria — nesse caso vence hoje. Cobrar imediatamente é o comportamento
   * correto: quanto menos tempo até o show, mais urgente é o pagamento entrar.
   */
  private dueDate(startAt: Date): Date {
    const now = this.clock.now();
    const due = new Date(
      startAt.getTime() - BOOKING_ESCROW_DUE_HOURS_BEFORE_SHOW * 3_600_000,
    );
    return due < now ? now : due;
  }
}
