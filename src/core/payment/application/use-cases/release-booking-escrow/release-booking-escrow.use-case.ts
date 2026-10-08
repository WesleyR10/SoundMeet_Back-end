import { BookingId } from "../../../../scheduling/domain/booking.aggregate";
import { IBookingRepository } from "../../../../scheduling/domain/booking.repository";
import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { IUnitOfWork } from "../../../../shared/domain/repository/unit-of-work.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  BookingEscrow,
  BookingEscrowId,
} from "../../../domain/booking-escrow.aggregate";
import { BookingEscrowStatus } from "../../../domain/booking-escrow-enums";
import { IBookingEscrowRepository } from "../../../domain/repositories/booking-escrow.repository";
import { IMusicianWalletRepository } from "../../../domain/repositories/musician-wallet.repository";
import { IBookingEscrowGateway } from "../../../infra/gateways/booking-escrow-gateway.interface";

export type ReleaseBookingEscrowInput = {
  escrow_id: string;
  /** Registrado no histórico — "liberação automática", "mediação", etc. */
  note?: string | null;
  /**
   * Libera contornando as duas condições automáticas — o caminho da **mediação
   * humana**, único legítimo para liberar sem check-in ou com contestação
   * aberta (a mediação decidiu a favor do artista).
   *
   * Exige justificativa escrita: uma liberação que ignora as salvaguardas é
   * exatamente a que alguém vai precisar explicar depois.
   */
  mediation?: { justification: string };
};

export type ReleaseBookingEscrowOutput = {
  escrow_id: string;
  status: string;
  net_amount: number;
  platform_fee: number;
  released_at: Date | null;
};

export type ReleaseBookingEscrowDeps = {
  escrowRepo: IBookingEscrowRepository;
  walletRepo: IMusicianWalletRepository;
  gateway: IBookingEscrowGateway;
  /**
   * Necessário para as salvaguardas de liberação (check-in e contestação).
   *
   * Não é opcional de propósito: sem ele o use-case liberaria sem conferir nada,
   * que é exatamente a falha que ele existe para impedir.
   */
  bookingRepo: IBookingRepository;
  /**
   * Custódia e carteira mudam JUNTAS ou não mudam.
   *
   * 🔴 Sem transação, uma falha entre os dois updates deixaria a custódia
   * `released` com o `held_balance` ainda inflado — e a reexecução **não
   * repara**, porque o `return` antecipado de custódia já liberada acontece
   * antes de a carteira ser tocada. O músico perderia o crédito em definitivo,
   * sem erro visível. Mesmo desenho de `ConfirmTipPaymentUseCase`.
   */
  uow: IUnitOfWork;
  clock?: IClock;
  domainEventMediator?: DomainEventMediator;
};

/**
 * Libera a custódia: o dinheiro deixa de estar retido e vira saldo do músico.
 *
 * É **o único momento** em que a comissão da plataforma vira receita — a
 * cláusula `papel_da_plataforma.com_custodia` afirma que show não realizado não
 * gera comissão nenhuma.
 *
 * ## A ordem das três operações não é arbitrária
 *
 * 1. **Provedor primeiro.** É onde o dinheiro está de verdade; nosso registro é
 *    espelho. Marcar como liberado aqui e falhar lá deixaria o app anunciando
 *    um saldo que o gateway recusa a sacar — o pior dos dois erros possíveis.
 * 2. **Custódia depois.** Se o provedor liberou e nós caímos, a reexecução é
 *    segura: `releaseEscrow` já liberado é no-op no provedor, e `release()` é
 *    no-op no agregado.
 * 3. **Carteira por último**, e só se a custódia mudou de estado nesta
 *    execução. É o que impede creditar duas vezes numa reentrega.
 *
 * ## As salvaguardas moram AQUI, não só no job
 *
 * Check-in registrado e ausência de contestação são conferidos neste use-case,
 * e não apenas em `ProcessDueEscrowReleasesUseCase`. A varredura continua
 * fazendo a própria checagem — ela precisa do motivo do pulo para o relatório —,
 * mas deixar a regra só lá tornaria qualquer chamador futuro (uma rota
 * administrativa de "liberar agora", um script de suporte) capaz de entregar o
 * cachê de um show que ninguém confirmou ter acontecido, sem nenhum aviso. Uma
 * salvaguarda que depende de o próximo programador lembrar dela não é uma
 * salvaguarda.
 *
 * O único caminho que as contorna é `mediation`, explícito e com justificativa.
 */
export class ReleaseBookingEscrowUseCase implements IUseCase<
  ReleaseBookingEscrowInput,
  ReleaseBookingEscrowOutput
> {
  private readonly clock: IClock;

  constructor(private readonly deps: ReleaseBookingEscrowDeps) {
    this.clock = deps.clock ?? { now: () => new Date() };
  }

  async execute(
    input: ReleaseBookingEscrowInput,
  ): Promise<ReleaseBookingEscrowOutput> {
    const escrow = await this.deps.escrowRepo.findById(
      new BookingEscrowId(input.escrow_id),
    );
    if (!escrow) {
      throw new NotFoundError(input.escrow_id, BookingEscrow);
    }

    /*
     * Já liberada: devolve o estado sem tocar em nada. O job e o webhook do
     * provedor podem chegar os dois para a mesma custódia, e creditar a
     * carteira de novo seria pagar duas vezes o mesmo show.
     */
    if (escrow.status === BookingEscrowStatus.RELEASED) {
      return this.toOutput(escrow);
    }

    await this.assertReleasable(escrow, input.mediation);

    /*
     * O estado local é conferido ANTES de falar com o provedor.
     *
     * "Provedor primeiro" vale para a ORDEM das escritas, não para dispensar a
     * validação: uma custódia `pending` (cobrança emitida, ninguém pagou) com
     * check-in registrado passaria pelas salvaguardas e mandaria
     * `releaseEscrow` numa cobrança não paga — pedindo ao provedor para liberar
     * uma garantia que não existe. O agregado recusaria depois, mas a chamada
     * já teria acontecido.
     */
    if (
      escrow.status !== BookingEscrowStatus.HELD &&
      escrow.status !== BookingEscrowStatus.DISPUTED
    ) {
      throw new InvalidArgumentError(
        `Não é possível liberar uma custódia ${escrow.status}`,
      );
    }

    if (escrow.external_id) {
      await this.deps.gateway.releaseEscrow(escrow.external_id);
    }

    const now = this.clock.now();
    const note = input.mediation
      ? `Mediação: ${input.mediation.justification}`
      : (input.note ?? null);
    escrow.release({ at: now, note });

    if (escrow.notification.hasErrors()) {
      throw new EntityValidationError(escrow.notification.toJSON());
    }

    /*
     * Custódia e carteira numa transação só. As duas escritas descrevem o mesmo
     * fato ("o dinheiro deixou de estar retido"); persistir uma sem a outra
     * deixaria o espelho mentindo, e a reexecução não corrige porque a custódia
     * já estaria `released`.
     */
    await this.deps.uow.do(async () => {
      await this.deps.escrowRepo.update(escrow);

      /*
       * A carteira é o espelho local do saldo na subconta. Custódia sem músico
       * (booking de banda sem líder resolvido, por exemplo) não credita
       * ninguém — o valor foi liberado no provedor e o acerto é manual, mas
       * nunca cai numa carteira errada por conveniência.
       */
      if (!escrow.musician_id) return;

      const wallet = await this.deps.walletRepo.findByMusicianId(
        escrow.musician_id.id,
      );
      if (!wallet) return;

      wallet.releaseHeldFunds(escrow.net_amount.amount);
      if (wallet.notification.hasErrors()) {
        throw new EntityValidationError(wallet.notification.toJSON());
      }
      await this.deps.walletRepo.update(wallet);
    });

    if (this.deps.domainEventMediator) {
      await this.deps.domainEventMediator.publish(escrow);
      escrow.clearEvents();
    }

    return this.toOutput(escrow);
  }

  /**
   * As duas condições da liberação automática.
   *
   * 1. **Check-in registrado** — prova de que a apresentação aconteceu. Liberar
   *    sem ele entregaria o cachê de um show que ninguém confirmou.
   * 2. **Sem contestação aberta** — liberar com uma em curso seria decidir a
   *    disputa a favor de um lado por omissão, e a mediação é humana de
   *    propósito.
   *
   * Booking ausente é bloqueio, não passe livre: sem a reserva não há como
   * afirmar que o show aconteceu, e o lado seguro de "não sei" é não pagar.
   */
  private async assertReleasable(
    escrow: BookingEscrow,
    mediation?: { justification: string },
  ): Promise<void> {
    if (mediation) {
      if (!mediation.justification?.trim()) {
        throw new InvalidArgumentError(
          "Liberação por mediação exige justificativa registrada",
        );
      }
      return;
    }

    /*
     * Custódia congelada pela mediação só sai por mediação.
     *
     * `escrow.dispute()` é o ato de congelar; `booking.isDisputed` é o sinal do
     * estabelecimento. Conferir só o segundo deixaria a varredura automática
     * liberar uma custódia que um humano congelou de propósito — bastaria a
     * contestação do booking ter sido resolvida antes da mediação terminar.
     */
    if (escrow.status === BookingEscrowStatus.DISPUTED) {
      throw new InvalidArgumentError(
        "Custódia em mediação — liberação exige decisão registrada",
      );
    }

    const booking = await this.deps.bookingRepo.findById(
      new BookingId(escrow.booking_id.id),
    );

    if (!booking) {
      throw new InvalidArgumentError(
        `Reserva ${escrow.booking_id.id} não encontrada — custódia não pode ser liberada`,
      );
    }

    if (!booking.isCheckedIn) {
      throw new InvalidArgumentError(
        "Apresentação não registrada — custódia não pode ser liberada",
      );
    }

    if (booking.isDisputed) {
      throw new InvalidArgumentError(
        "Contestação em aberto — liberação depende de mediação",
      );
    }
  }

  private toOutput(escrow: BookingEscrow): ReleaseBookingEscrowOutput {
    return {
      escrow_id: escrow.escrow_id.id,
      status: escrow.status,
      net_amount: escrow.net_amount.amount,
      platform_fee: escrow.platform_fee.amount,
      released_at: escrow.released_at,
    };
  }
}
