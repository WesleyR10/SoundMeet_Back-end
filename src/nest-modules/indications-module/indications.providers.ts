import { PrismaClient } from "@prisma/client";

import { ListEstablishmentIndicationsUseCase } from "../../core/indication/application/use-cases/list-establishment-indications/list-establishment-indications.use-case";
import { RecordIndicationUseCase } from "../../core/indication/application/use-cases/record-indication/record-indication.use-case";
import { UpdateIndicationStatusUseCase } from "../../core/indication/application/use-cases/update-indication-status/update-indication-status.use-case";
import { IIndicationRepository } from "../../core/indication/domain/indication.repository";
import { IndicationPrismaRepository } from "../../core/indication/infra/db/prisma/indication-prisma.repository";
import { PrismaService } from "../database-module/prisma/prisma.service";

export const REPOSITORIES = {
  INDICATION_REPOSITORY: {
    provide: "IndicationRepository",
    useFactory: (prisma: PrismaClient) =>
      new IndicationPrismaRepository(prisma),
    inject: [PrismaService],
  },
};

export const USE_CASES = {
  RECORD_INDICATION_USE_CASE: {
    provide: RecordIndicationUseCase,
    useFactory: (repo: IIndicationRepository) =>
      new RecordIndicationUseCase(repo),
    inject: [REPOSITORIES.INDICATION_REPOSITORY.provide],
  },
  LIST_ESTABLISHMENT_INDICATIONS_USE_CASE: {
    provide: ListEstablishmentIndicationsUseCase,
    useFactory: (repo: IIndicationRepository) =>
      new ListEstablishmentIndicationsUseCase(repo),
    inject: [REPOSITORIES.INDICATION_REPOSITORY.provide],
  },
  UPDATE_INDICATION_STATUS_USE_CASE: {
    provide: UpdateIndicationStatusUseCase,
    useFactory: (repo: IIndicationRepository) =>
      new UpdateIndicationStatusUseCase(repo),
    inject: [REPOSITORIES.INDICATION_REPOSITORY.provide],
  },
};

export const INDICATION_PROVIDERS = { REPOSITORIES, USE_CASES };
