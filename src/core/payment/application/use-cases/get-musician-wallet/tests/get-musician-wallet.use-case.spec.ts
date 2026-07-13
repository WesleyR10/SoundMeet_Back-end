import {
  MusicianWallet,
  MusicianWalletInMemoryRepository,
} from "@core/payment";
import { PlanCheckService, SubscriptionInMemoryRepository } from "@core/plans";
import { Money, Uuid } from "@core/shared/domain";
import { NotFoundError } from "@core/shared/domain/errors";

import { GetMusicianWalletUseCase } from "../get-musician-wallet.use-case";

describe("GetMusicianWalletUseCase Unit Tests", () => {
  let useCase: GetMusicianWalletUseCase;
  let repository: MusicianWalletInMemoryRepository;

  beforeEach(() => {
    repository = new MusicianWalletInMemoryRepository();
    useCase = new GetMusicianWalletUseCase(repository);
  });

  it("should return a musician wallet", async () => {
    const musicianId = new Uuid();
    const wallet = new MusicianWallet({
      musician_id: musicianId,
      balance: new Money(100),
      total_earned: new Money(100),
      total_withdrawn: new Money(0),
    });
    await repository.insert(wallet);

    const output = await useCase.execute({ musician_id: musicianId.id });

    expect(output.id).toBe(wallet.wallet_id.id);
    expect(output.musician_id).toBe(musicianId.id);
    expect(output.balance).toBe(100);
  });

  it("should throw error when wallet not found", async () => {
    const musicianId = new Uuid();
    await expect(
      useCase.execute({ musician_id: musicianId.id }),
    ).rejects.toThrow(new NotFoundError(musicianId.id, MusicianWallet));
  });

  it("should fall back to FREE plan withdrawal config when PlanCheckService is not injected", async () => {
    const musicianId = new Uuid();
    const wallet = MusicianWallet.create({ musician_id: musicianId.id });
    await repository.insert(wallet);

    const output = await useCase.execute({ musician_id: musicianId.id });

    expect(output.min_withdrawal_amount_brl).toBe(110);
    expect(output.withdrawal_days).toBe(5);
  });

  it("should expose min_withdrawal_amount_brl/withdrawal_days for a FREE-tier musician when PlanCheckService is injected", async () => {
    const musicianId = new Uuid();
    const wallet = MusicianWallet.create({ musician_id: musicianId.id });
    await repository.insert(wallet);

    const planCheckService = new PlanCheckService(
      new SubscriptionInMemoryRepository(),
    );
    const useCaseWithPlan = new GetMusicianWalletUseCase(
      repository,
      planCheckService,
    );

    const output = await useCaseWithPlan.execute({
      musician_id: musicianId.id,
    });

    expect(output.min_withdrawal_amount_brl).toBe(110);
    expect(output.withdrawal_days).toBe(5);
  });
});
