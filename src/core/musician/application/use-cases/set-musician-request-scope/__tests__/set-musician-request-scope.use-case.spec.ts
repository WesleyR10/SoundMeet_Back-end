import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { SetMusicianRequestScopeUseCase } from "../set-musician-request-scope.use-case";

describe("SetMusicianRequestScopeUseCase", () => {
  let repository: MusicianInMemoryRepository;
  let useCase: SetMusicianRequestScopeUseCase;

  beforeEach(() => {
    repository = new MusicianInMemoryRepository();
    useCase = new SetMusicianRequestScopeUseCase(repository);
  });

  it("nasce aceitando pedido fora do repertório, e desligar persiste", async () => {
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);
    expect(musician.accepts_requests_outside_repertoire).toBe(true);

    const output = await useCase.execute({
      id: musician.musician_id.id,
      accepts_requests_outside_repertoire: false,
    });

    expect(output.accepts_requests_outside_repertoire).toBe(false);
    const found = await repository.findById(musician.musician_id);
    expect(found!.accepts_requests_outside_repertoire).toBe(false);
  });

  it("religar volta ao comportamento padrão", async () => {
    const musician = Musician.fake().aMusician().build();
    musician.setAcceptsRequestsOutsideRepertoire(false);
    await repository.insert(musician);

    const output = await useCase.execute({
      id: musician.musician_id.id,
      accepts_requests_outside_repertoire: true,
    });

    expect(output.accepts_requests_outside_repertoire).toBe(true);
  });

  it("não mexe no radar de contratação: são interruptores independentes", async () => {
    const musician = Musician.fake().aMusician().withOpenToGigs(true).build();
    await repository.insert(musician);

    const output = await useCase.execute({
      id: musician.musician_id.id,
      accepts_requests_outside_repertoire: false,
    });

    expect(output.open_to_gigs).toBe(true);
  });

  it("músico inexistente lança NotFoundError", async () => {
    await expect(
      useCase.execute({
        id: "9366b7dc-2d71-4799-b91c-c64adb205104",
        accepts_requests_outside_repertoire: false,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
