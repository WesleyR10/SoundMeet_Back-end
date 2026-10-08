import { ForbiddenException } from "@nestjs/common";

import { Repertoire } from "../../../../../repertoire/domain/repertoire.aggregate";
import { RepertoireInMemoryRepository } from "../../../../../repertoire/infra/db/in-memory/repertoire-in-memory.repository";
import { Uuid } from "../../../../../shared/domain";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Performance } from "../../../../domain/performance.aggregate";
import { PerformanceInMemoryRepository } from "../../../../infra/db/in-memory/performance-in-memory.repository";
import { PerformanceSetlistService } from "../../../services/performance-setlist.service";
import { ChangePerformanceSetlistUseCase } from "../change-performance-setlist.use-case";

describe("ChangePerformanceSetlistUseCase", () => {
  const musicianId = new Uuid().id;
  let performanceRepo: PerformanceInMemoryRepository;
  let repertoireRepo: RepertoireInMemoryRepository;
  let useCase: ChangePerformanceSetlistUseCase;
  let performance: Performance;
  let mine: Repertoire;

  beforeEach(async () => {
    performanceRepo = new PerformanceInMemoryRepository();
    repertoireRepo = new RepertoireInMemoryRepository();
    useCase = new ChangePerformanceSetlistUseCase(
      performanceRepo,
      new PerformanceSetlistService(repertoireRepo),
    );
    performance = Performance.create({
      event_id: new Uuid().id,
      establishment_id: new Uuid().id,
      musician_id: musicianId,
    });
    await performanceRepo.insert(performance);
    mine = Repertoire.create({ musician_id: musicianId, name: "Sexta" });
    await repertoireRepo.insert(mine);
  });

  const run = (repertoire_id: string | null, requester = musicianId) =>
    useCase.execute({
      performance_id: performance.performance_id.id,
      requesting_musician_id: requester,
      repertoire_id,
    });

  it("troca e depois remove a setlist com o set no ar", async () => {
    expect((await run(mine.repertoire_id.id)).repertoire_id).toBe(mine.repertoire_id.id);
    expect((await run(null)).repertoire_id).toBeNull();
  });

  it("recusa repertório alheio como inexistente", async () => {
    const theirs = Repertoire.create({ musician_id: new Uuid().id, name: "Alheio" });
    await repertoireRepo.insert(theirs);
    await expect(run(theirs.repertoire_id.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("só o dono do set troca", async () => {
    await expect(run(null, new Uuid().id)).rejects.toBeInstanceOf(ForbiddenException);
  });

  // Trocar o plano de um show que já aconteceu reescreveria o "tocou X de Y".
  it("set encerrado não aceita troca", async () => {
    performance.endPerformance();
    await performanceRepo.update(performance);
    await expect(run(mine.repertoire_id.id)).rejects.toBeInstanceOf(EntityValidationError);
  });
});
