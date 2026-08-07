import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../database-module/prisma/prisma.service";

type ProcessedEventRow = {
  id: string;
  status: string;
  attempts: number;
};

/**
 * Idempotência de eventos de pagamento com o Postgres como fonte de verdade.
 *
 * O padrão anterior era `cache.get → work → cache.set` no Redis. Duas falhas:
 * a janela entre o get e o set deixava reentregas simultâneas do MESMO evento
 * passarem as duas (crédito duplicado de gorjeta), e um restart/evicção do
 * Redis apagava a marca, liberando replay depois. Aqui o claim é um INSERT com
 * `eventKey` UNIQUE: quem perde a corrida recebe P2002 e desiste, e a marca
 * sobrevive a qualquer reinício.
 *
 * Estados de `processed_events.status`:
 *   processing → alguém está executando (lease de PROCESSING_LEASE_MS)
 *   completed  → efeito aplicado; qualquer reentrega vira no-op
 *   failed     → efeito não aplicado; a próxima reentrega pode reprocessar
 */
@Injectable()
export class PaymentEventProcessingService {
  private static readonly SCOPE = "payment";

  // Se o processo morre no meio do trabalho a linha fica presa em "processing".
  // Passado o lease, uma reentrega pode retomar o claim — sem isso um crash
  // bloquearia aquele evento para sempre.
  private static readonly PROCESSING_LEASE_MS = 5 * 60 * 1000;

  private readonly logger = new Logger(PaymentEventProcessingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async processOnce<T>(
    idempotencyKey: string,
    work: () => Promise<T>,
  ): Promise<T | null> {
    const claim = await this.claim(idempotencyKey);
    if (!claim) {
      this.logger.log(
        JSON.stringify({
          event: "payment_event.skipped_duplicate",
          idempotency_key: idempotencyKey,
        }),
      );
      return null;
    }

    try {
      const result = await this.retry(work);
      await this.markCompleted(claim.id);
      return result;
    } catch (error) {
      await this.markFailed(claim.id, error);
      throw error;
    }
  }

  /**
   * Retorna a linha reivindicada, ou null quando outra execução já detém o
   * evento (ou já o concluiu). Toda decisão é atômica no banco.
   */
  private async claim(
    idempotencyKey: string,
  ): Promise<ProcessedEventRow | null> {
    try {
      return await this.prisma.processedEvent.create({
        data: {
          eventKey: idempotencyKey,
          scope: PaymentEventProcessingService.SCOPE,
          status: "processing",
          attempts: 1,
        },
        select: { id: true, status: true, attempts: true },
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }
    }

    const existing = await this.prisma.processedEvent.findUnique({
      where: { eventKey: idempotencyKey },
      select: { id: true, status: true, attempts: true },
    });

    if (!existing || existing.status === "completed") {
      return null;
    }

    // Retomada: só vence quem conseguir mudar a linha a partir do estado que
    // leu. O updateMany condicional é o compare-and-set.
    const leaseDeadline = new Date(
      Date.now() - PaymentEventProcessingService.PROCESSING_LEASE_MS,
    );

    const { count } = await this.prisma.processedEvent.updateMany({
      where: {
        id: existing.id,
        OR: [
          { status: "failed" },
          { status: "processing", updated_at: { lt: leaseDeadline } },
        ],
      },
      data: {
        status: "processing",
        attempts: { increment: 1 },
        last_error: null,
      },
    });

    if (count === 0) {
      return null;
    }

    this.logger.warn(
      JSON.stringify({
        event: "payment_event.reclaimed",
        idempotency_key: idempotencyKey,
        previous_status: existing.status,
        attempts: existing.attempts + 1,
      }),
    );

    return { ...existing, status: "processing" };
  }

  private async markCompleted(id: string): Promise<void> {
    await this.prisma.processedEvent.update({
      where: { id },
      data: { status: "completed", completed_at: new Date(), last_error: null },
    });
  }

  // Libera o evento para reprocessamento na próxima reentrega do gateway: o
  // efeito não foi aplicado, então manter a marca seria perder o pagamento.
  private async markFailed(id: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await this.prisma.processedEvent.update({
        where: { id },
        data: { status: "failed", last_error: message.slice(0, 1000) },
      });
    } catch (updateError) {
      this.logger.error(
        JSON.stringify({
          event: "payment_event.mark_failed_error",
          processed_event_id: id,
          reason: String(updateError),
        }),
      );
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  private async retry<T>(work: () => Promise<T>): Promise<T> {
    const maxAttempts = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await work();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 50));
        }
      }
    }

    throw lastError;
  }
}
