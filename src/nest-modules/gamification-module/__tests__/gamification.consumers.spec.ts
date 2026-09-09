import { ModuleRef } from "@nestjs/core";

import { CalculateRankingUseCase } from "../../../core/gamification/application/use-cases/calculate-ranking/calculate-ranking.use-case";
import {
  RankingPeriodEnum,
  RankingTypeEnum,
} from "../../../core/gamification/domain/value-objects/ranking-type.vo";
import { GamificationTipCompletedConsumer } from "../gamification.consumers";

function makeModuleRef(execute = jest.fn().mockResolvedValue([])): ModuleRef {
  return {
    resolve: jest.fn().mockResolvedValue({ execute }),
  } as unknown as ModuleRef;
}

function validMsg(overrides: Record<string, unknown> = {}) {
  return {
    payload: {
      tip_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      amount: 50,
      musician_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      audience_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      band_id: null,
      occurred_on: new Date().toISOString(),
    },
    event_name: "payment.tip.completed",
    event_version: 1,
    occurred_on: new Date(),
    ...overrides,
  };
}

describe("GamificationTipCompletedConsumer", () => {
  it("recalcula TOP_FAS e TOP_APOIADORES em paralelo ao receber tip concluído", async () => {
    const execute = jest.fn().mockResolvedValue([]);
    const consumer = new GamificationTipCompletedConsumer(
      makeModuleRef(execute),
    );

    await consumer.onTipCompleted(validMsg());

    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenCalledWith({
      type: RankingTypeEnum.TOP_FAS,
      period: RankingPeriodEnum.MONTHLY,
    });
    expect(execute).toHaveBeenCalledWith({
      type: RankingTypeEnum.TOP_APOIADORES,
      period: RankingPeriodEnum.MONTHLY,
    });
  });

  it("resolve CalculateRankingUseCase via moduleRef a cada mensagem", async () => {
    const execute = jest.fn().mockResolvedValue([]);
    const moduleRef = makeModuleRef(execute);
    const consumer = new GamificationTipCompletedConsumer(moduleRef);

    await consumer.onTipCompleted(validMsg());

    expect(moduleRef.resolve).toHaveBeenCalledWith(CalculateRankingUseCase);
  });

  it("propaga erro quando CalculateRankingUseCase falha (mensagem vai para DLX via filter)", async () => {
    const execute = jest.fn().mockRejectedValue(new Error("db failure"));
    const consumer = new GamificationTipCompletedConsumer(
      makeModuleRef(execute),
    );

    await expect(consumer.onTipCompleted(validMsg())).rejects.toThrow(
      "db failure",
    );
  });

  it("processa mensagem com payload incompleto sem lançar exceção de tipagem", async () => {
    const execute = jest.fn().mockResolvedValue([]);
    const consumer = new GamificationTipCompletedConsumer(
      makeModuleRef(execute),
    );

    await consumer.onTipCompleted({ payload: {} });

    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("processa mensagem sem campo payload (mensagem malformada do broker)", async () => {
    const execute = jest.fn().mockResolvedValue([]);
    const consumer = new GamificationTipCompletedConsumer(
      makeModuleRef(execute),
    );

    await consumer.onTipCompleted({});

    expect(execute).toHaveBeenCalledTimes(2);
  });
});
