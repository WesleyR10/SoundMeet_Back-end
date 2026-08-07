import { Prisma } from "@prisma/client";

import { PaymentEventProcessingService } from "../payment-event-processing.service";

type Row = {
  id: string;
  eventKey: string;
  scope: string;
  status: string;
  attempts: number;
  last_error: string | null;
  completed_at: Date | null;
  updated_at: Date;
};

/**
 * Dobra do `processedEvent` do Prisma que reproduz a garantia que interessa:
 * `eventKey` é UNIQUE, então o segundo `create` da mesma chave estoura P2002.
 * O JS é single-threaded entre awaits, mas as chamadas são intercaladas — é
 * exatamente a janela em que o guard antigo (get → work → set) falhava.
 */
class FakePrisma {
  readonly rows = new Map<string, Row>();
  private sequence = 0;

  processedEvent = {
    create: async ({ data, select: _select }: any): Promise<Row> => {
      await tick();
      if (this.rows.has(data.eventKey)) {
        throw new Prisma.PrismaClientKnownRequestError("Unique constraint", {
          code: "P2002",
          clientVersion: "test",
        });
      }
      const row: Row = {
        id: `row-${++this.sequence}`,
        eventKey: data.eventKey,
        scope: data.scope,
        status: data.status,
        attempts: data.attempts ?? 0,
        last_error: null,
        completed_at: null,
        updated_at: new Date(),
      };
      this.rows.set(row.eventKey, row);
      return row;
    },

    findUnique: async ({ where }: any): Promise<Row | null> => {
      await tick();
      return this.rows.get(where.eventKey) ?? null;
    },

    update: async ({ where, data }: any): Promise<Row> => {
      await tick();
      const row = this.find(where.id);
      Object.assign(row, data, { updated_at: new Date() });
      return row;
    },

    updateMany: async ({ where, data }: any): Promise<{ count: number }> => {
      await tick();
      const row = this.find(where.id);
      const matches = (where.OR as any[]).some((clause) => {
        if (clause.status !== row.status) return false;
        if (clause.updated_at?.lt) return row.updated_at < clause.updated_at.lt;
        return true;
      });
      if (!matches) return { count: 0 };

      const { attempts, ...rest } = data;
      Object.assign(row, rest, { updated_at: new Date() });
      if (attempts?.increment) row.attempts += attempts.increment;
      return { count: 1 };
    },
  };

  private find(id: string): Row {
    for (const row of this.rows.values()) {
      if (row.id === id) return row;
    }
    throw new Error(`Row ${id} not found`);
  }
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe("PaymentEventProcessingService", () => {
  let prisma: FakePrisma;
  let service: PaymentEventProcessingService;

  beforeEach(() => {
    prisma = new FakePrisma();
    service = new PaymentEventProcessingService(prisma as never);
  });

  it("executa o work na primeira entrega e marca o evento como completed", async () => {
    const work = jest.fn().mockResolvedValue("creditado");

    await expect(service.processOnce("asaas:payment:1", work)).resolves.toBe(
      "creditado",
    );

    expect(work).toHaveBeenCalledTimes(1);
    expect(prisma.rows.get("asaas:payment:1")?.status).toBe("completed");
  });

  it("ignora reentrega sequencial do mesmo evento", async () => {
    const work = jest.fn().mockResolvedValue("creditado");

    await service.processOnce("asaas:payment:1", work);
    await expect(
      service.processOnce("asaas:payment:1", work),
    ).resolves.toBeNull();

    expect(work).toHaveBeenCalledTimes(1);
  });

  it("credita UMA vez com 20 entregas concorrentes do mesmo evento", async () => {
    let credits = 0;
    const work = async () => {
      await tick();
      credits += 1;
      return credits;
    };

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        service.processOnce("asaas:payment_received:pay_123", work),
      ),
    );

    expect(credits).toBe(1);
    expect(results.filter((r) => r !== null)).toHaveLength(1);
  });

  it("não reprocessa após restart do Redis — a marca vive no Postgres", async () => {
    const work = jest.fn().mockResolvedValue("creditado");
    await service.processOnce("asaas:payment:1", work);

    // Nova instância = processo reiniciado. O ledger continua no banco.
    const afterRestart = new PaymentEventProcessingService(prisma as never);
    await expect(
      afterRestart.processOnce("asaas:payment:1", work),
    ).resolves.toBeNull();

    expect(work).toHaveBeenCalledTimes(1);
  });

  it("libera o evento para reprocessamento quando o work falha", async () => {
    const failing = jest
      .fn()
      .mockRejectedValue(new Error("gateway fora do ar"));

    await expect(
      service.processOnce("asaas:payment:1", failing),
    ).rejects.toThrow("gateway fora do ar");

    const row = prisma.rows.get("asaas:payment:1");
    expect(row?.status).toBe("failed");
    expect(row?.last_error).toBe("gateway fora do ar");

    const succeeding = jest.fn().mockResolvedValue("creditado");
    await expect(
      service.processOnce("asaas:payment:1", succeeding),
    ).resolves.toBe("creditado");
    expect(prisma.rows.get("asaas:payment:1")?.status).toBe("completed");
  });

  it("mantém o evento bloqueado enquanto o lease de processing está vigente", async () => {
    const work = jest.fn().mockResolvedValue("creditado");
    prisma.rows.set("asaas:payment:1", {
      id: "row-preso",
      eventKey: "asaas:payment:1",
      scope: "payment",
      status: "processing",
      attempts: 1,
      last_error: null,
      completed_at: null,
      updated_at: new Date(),
    });

    await expect(
      service.processOnce("asaas:payment:1", work),
    ).resolves.toBeNull();
    expect(work).not.toHaveBeenCalled();
  });

  it("retoma evento preso em processing após o lease expirar (crash do processo)", async () => {
    const work = jest.fn().mockResolvedValue("creditado");
    prisma.rows.set("asaas:payment:1", {
      id: "row-preso",
      eventKey: "asaas:payment:1",
      scope: "payment",
      status: "processing",
      attempts: 1,
      last_error: null,
      completed_at: null,
      updated_at: new Date(Date.now() - 10 * 60 * 1000),
    });

    await expect(service.processOnce("asaas:payment:1", work)).resolves.toBe(
      "creditado",
    );
    expect(prisma.rows.get("asaas:payment:1")?.status).toBe("completed");
    expect(prisma.rows.get("asaas:payment:1")?.attempts).toBe(2);
  });

  it("isola eventos distintos do mesmo pagamento", async () => {
    const work = jest.fn().mockResolvedValue("ok");

    await service.processOnce("asaas:payment_received:pay_1", work);
    await service.processOnce("asaas:transfer_done:tra_1", work);

    expect(work).toHaveBeenCalledTimes(2);
  });
});
