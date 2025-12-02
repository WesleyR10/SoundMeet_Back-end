import { PrismaService } from "../database-module/prisma/prisma.service";
import { CreateEstablishmentUseCase } from "../../core/establishment/application/use-cases/create-establishment/create-establishment.use-case";
import { UpdateEstablishmentUseCase } from "../../core/establishment/application/use-cases/update-establishment/update-establishment.use-case";
import { ListEstablishmentsUseCase } from "../../core/establishment/application/use-cases/list-establishments/list-establishments.use-case";
import { GetEstablishmentUseCase } from "../../core/establishment/application/use-cases/get-establishment/get-establishment.use-case";
import { DeleteEstablishmentUseCase } from "../../core/establishment/application/use-cases/delete-establishment/delete-establishment.use-case";
import { EstablishmentPrismaRepository } from "../../core/establishment/infra/db/prisma/establishment-prisma.repository";
import { IEstablishmentRepository } from "../../core/establishment/domain/establishment.repository";

export const REPOSITORIES = {
  ESTABLISHMENT_REPOSITORY: {
    provide: "EstablishmentRepository",
    useExisting: EstablishmentPrismaRepository,
  },
  ESTABLISHMENT_PRISMA_REPOSITORY: {
    provide: EstablishmentPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new EstablishmentPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
};

export const USE_CASES = {
  CREATE_ESTABLISHMENT_USE_CASE: {
    provide: CreateEstablishmentUseCase,
    useFactory: (establishmentRepo: IEstablishmentRepository) => {
      return new CreateEstablishmentUseCase(establishmentRepo);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide],
  },
  UPDATE_ESTABLISHMENT_USE_CASE: {
    provide: UpdateEstablishmentUseCase,
    useFactory: (establishmentRepo: IEstablishmentRepository) => {
      return new UpdateEstablishmentUseCase(establishmentRepo);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide],
  },
  LIST_ESTABLISHMENTS_USE_CASE: {
    provide: ListEstablishmentsUseCase,
    useFactory: (establishmentRepo: IEstablishmentRepository) => {
      return new ListEstablishmentsUseCase(establishmentRepo);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide],
  },
  GET_ESTABLISHMENT_USE_CASE: {
    provide: GetEstablishmentUseCase,
    useFactory: (establishmentRepo: IEstablishmentRepository) => {
      return new GetEstablishmentUseCase(establishmentRepo);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide],
  },
  DELETE_ESTABLISHMENT_USE_CASE: {
    provide: DeleteEstablishmentUseCase,
    useFactory: (establishmentRepo: IEstablishmentRepository) => {
      return new DeleteEstablishmentUseCase(establishmentRepo);
    },
    inject: [REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide],
  },
};

export const ESTABLISHMENT_PROVIDERS = {
  REPOSITORIES,
  USE_CASES,
};
