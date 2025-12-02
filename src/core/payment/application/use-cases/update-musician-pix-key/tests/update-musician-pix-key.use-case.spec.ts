import { MusicianWallet, MusicianWalletInMemoryRepository } from "@core/payment";
import { UpdateMusicianPixKeyUseCase } from "../update-musician-pix-key.use-case";
import { Money, Uuid } from "@core/shared/domain/value-objects";

describe("UpdateMusicianPixKeyUseCase Unit Tests", () => {
  let useCase: UpdateMusicianPixKeyUseCase;
  let repository: MusicianWalletInMemoryRepository;

  beforeEach(() => {
    repository = new MusicianWalletInMemoryRepository();
    useCase = new UpdateMusicianPixKeyUseCase(repository);
  });

  it("should update pix key for existing wallet", async () => {
    const musicianId = new Uuid();
    const wallet = new MusicianWallet({
      musician_id: musicianId,
      balance: new Money(0),
      total_earned: new Money(0),
      total_withdrawn: new Money(0),
    });
    await repository.insert(wallet);

    const pixKey = "test@pix.com";
    const pixKeyType = "email";
    const output = await useCase.execute({
      musician_id: musicianId.id,
      pix_key: pixKey,
      pix_key_type: pixKeyType,
    });

    expect(output.pix_key).toBe(pixKey);
    const updatedWallet = await repository.findByMusicianId(musicianId.id);
    expect(updatedWallet?.pix_key?.key).toBe(pixKey);
  });

  it("should create wallet and update pix key if wallet does not exist", async () => {
    const musicianId = new Uuid();
    const pixKey = "12345678900"; // CPF format
    const pixKeyType = "cpf";

    const output = await useCase.execute({
      musician_id: musicianId.id,
      pix_key: pixKey,
      pix_key_type: pixKeyType,
    });

    expect(output.musician_id).toBe(musicianId.id);
    expect(output.pix_key).toBe(pixKey);
    
    const createdWallet = await repository.findByMusicianId(musicianId.id);
    expect(createdWallet).toBeDefined();
    expect(createdWallet?.pix_key?.key).toBe(pixKey);
  });
});
