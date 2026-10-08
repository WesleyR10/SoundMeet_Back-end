import { ForbiddenException } from "@nestjs/common";

import { Uuid } from "../../../../../shared/domain";
import { PerformanceInMemoryRepository } from "../../../../infra/db/in-memory/performance-in-memory.repository";
import { Repertoire } from "../../../../../repertoire/domain/repertoire.aggregate";
import { RepertoireInMemoryRepository } from "../../../../../repertoire/infra/db/in-memory/repertoire-in-memory.repository";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { PerformanceEligibilityService } from "../../../services/performance-eligibility.service";
import { PerformanceSetlistService } from "../../../services/performance-setlist.service";
import { StartPerformanceUseCase } from "../start-performance.use-case";

describe("StartPerformanceUseCase", () => {
  let repo: PerformanceInMemoryRepository;
  let eligibility: jest.Mocked<
    Pick<PerformanceEligibilityService, "assertCanOpenSet">
  >;
  let useCase: StartPerformanceUseCase;
  let repertoireRepo: RepertoireInMemoryRepository;

  const eventId = new Uuid().id;
  const musicianId = new Uuid().id;
  const establishmentId = new Uuid().id;

  beforeEach(() => {
    repo = new PerformanceInMemoryRepository();
    eligibility = {
      assertCanOpenSet: jest.fn().mockResolvedValue({
        establishment_id: establishmentId,
      }),
    };
    repertoireRepo = new RepertoireInMemoryRepository();
    useCase = new StartPerformanceUseCase(
      repo,
      eligibility as unknown as PerformanceEligibilityService,
      new PerformanceSetlistService(repertoireRepo),
    );
  });

  it("abre o set e deriva o estabelecimento do evento", async () => {
    const output = await useCase.execute({
      event_id: eventId,
      musician_id: musicianId,
    });

    expect(output.status).toBe("live");
    // O estabelecimento nunca vem do cliente: se viesse, o set ficaria gravado
    // num local onde o show não aconteceu — e é por local que F4 e F5 agregam.
    expect(output.establishment_id).toBe(establishmentId);
    expect(repo.items).toHaveLength(1);
  });

  it("é idempotente — reabrir devolve o set que já está no ar", async () => {
    const first = await useCase.execute({
      event_id: eventId,
      musician_id: musicianId,
    });
    const second = await useCase.execute({
      event_id: eventId,
      musician_id: musicianId,
    });

    expect(second.id).toBe(first.id);
    // Um retry depois de timeout que na verdade funcionou não pode virar 409
    // com o músico olhando a tela no meio do show.
    expect(repo.items).toHaveLength(1);
  });

  it("não abre set em evento onde o músico não está escalado", async () => {
    eligibility.assertCanOpenSet.mockRejectedValueOnce(
      new ForbiddenException("Você não está escalado para este evento."),
    );

    await expect(
      useCase.execute({ event_id: eventId, musician_id: musicianId }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(repo.items).toHaveLength(0);
  });

  it("checa elegibilidade ANTES de procurar set existente", async () => {
    eligibility.assertCanOpenSet.mockRejectedValueOnce(
      new ForbiddenException("nope"),
    );
    const spy = jest.spyOn(repo, "findLiveByEventAndMusician");

    await expect(
      useCase.execute({ event_id: eventId, musician_id: musicianId }),
    ).rejects.toThrow();

    expect(spy).not.toHaveBeenCalled();
  });

  describe("setlist da noite", () => {
    it("abre o set apontando para um repertório do próprio músico", async () => {
      const mine = Repertoire.create({ musician_id: musicianId, name: "Sexta no Bar" });
      await repertoireRepo.insert(mine);

      const output = await useCase.execute({
        event_id: eventId,
        musician_id: musicianId,
        repertoire_id: mine.repertoire_id.id,
      });

      expect(output.repertoire_id).toBe(mine.repertoire_id.id);
    });

    // 🔴 O id vem do corpo. Sem a checagem, o palco LERIA o repertório de
    // outra pessoa — títulos, ordem e notas pessoais.
    it("recusa repertório de OUTRO músico como se não existisse", async () => {
      const theirs = Repertoire.create({ musician_id: new Uuid().id, name: "Alheio" });
      await repertoireRepo.insert(theirs);

      await expect(
        useCase.execute({
          event_id: eventId,
          musician_id: musicianId,
          repertoire_id: theirs.repertoire_id.id,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.items).toHaveLength(0);
    });

    it("sem setlist é improviso, e continua válido", async () => {
      const output = await useCase.execute({ event_id: eventId, musician_id: musicianId });
      expect(output.repertoire_id).toBeNull();
    });
  });
});
