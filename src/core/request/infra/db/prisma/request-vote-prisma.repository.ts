import { PrismaClient } from "@prisma/client";

import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import {
  RequestVote,
  RequestVoteId,
} from "../../../domain/request-vote.aggregate";
import {
  IRequestVoteRepository,
  RequestVoteFilter,
  RequestVoteSearchParams,
  RequestVoteSearchResult,
} from "../../../domain/request-vote.repository";
import { RequestVoteType } from "../../../domain/value-objects/request-vote-type.vo";
import { RequestVoteModelMapper } from "./request-vote-model-mapper";

export class RequestVotePrismaRepository implements IRequestVoteRepository {
  sortableFields: string[] = ["created_at", "voteType"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: RequestVote): Promise<void> {
    const modelProps = RequestVoteModelMapper.toModel(entity);
    try {
      await this.prisma.requestVote.create({
        data: modelProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.request_vote_id.id,
        operation: "requestVote.create",
      });
    }
  }

  async bulkInsert(entities: RequestVote[]): Promise<void> {
    const modelsProps = entities.map(RequestVoteModelMapper.toModel);
    try {
      await this.prisma.requestVote.createMany({
        data: modelsProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        operation: "requestVote.createMany",
      });
    }
  }

  async update(entity: RequestVote): Promise<void> {
    const id = entity.request_vote_id.id;
    const modelProps = RequestVoteModelMapper.toModel(entity);
    try {
      await this.prisma.requestVote.update({
        where: { id },
        data: modelProps,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id,
        operation: "requestVote.update",
      });
    }
  }

  async delete(entity_id: RequestVoteId): Promise<void> {
    try {
      await this.prisma.requestVote.delete({
        where: { id: entity_id.id },
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity_id.id,
        operation: "requestVote.delete",
      });
    }
  }

  async findById(entity_id: RequestVoteId): Promise<RequestVote | null> {
    const model = await this.prisma.requestVote.findUnique({
      where: { id: entity_id.id },
    });
    return model ? RequestVoteModelMapper.toEntity(model) : null;
  }

  async findByIds(ids: RequestVoteId[]): Promise<RequestVote[]> {
    const models = await this.prisma.requestVote.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
    });
    return models.map(RequestVoteModelMapper.toEntity);
  }

  async existsById(ids: RequestVoteId[]): Promise<{
    exists: RequestVoteId[];
    not_exists: RequestVoteId[];
  }> {
    if (!ids.length) {
      throw new InvalidArgumentError(
        "ids must be an array with at least one element",
      );
    }

    const existingModels = await this.prisma.requestVote.findMany({
      where: {
        id: {
          in: ids.map((id) => id.id),
        },
      },
      select: { id: true },
    });

    const existingIds = existingModels.map((model) => model.id);
    return {
      exists: ids.filter((id) => existingIds.includes(id.id)),
      not_exists: ids.filter((id) => !existingIds.includes(id.id)),
    };
  }

  async findAll(): Promise<RequestVote[]> {
    const models = await this.prisma.requestVote.findMany();
    return models.map(RequestVoteModelMapper.toEntity);
  }

  async search(
    props: RequestVoteSearchParams,
  ): Promise<RequestVoteSearchResult> {
    const where = this.buildWhereClause(props.filter);
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const [models, count] = await Promise.all([
      this.prisma.requestVote.findMany({
        where,
        orderBy: this.buildOrderByClause(props.sort, props.sort_dir),
        skip: offset,
        take: limit,
      }),
      this.prisma.requestVote.count({ where }),
    ]);

    return new RequestVoteSearchResult({
      items: models.map(RequestVoteModelMapper.toEntity),
      total: count,
      current_page: props.page,
      per_page: props.per_page,
    });
  }

  async findByRequestId(request_id: string): Promise<RequestVote[]> {
    const models = await this.prisma.requestVote.findMany({
      where: { requestId: request_id },
      orderBy: { created_at: "desc" },
    });
    return models.map(RequestVoteModelMapper.toEntity);
  }

  async findByRequestAndAudience(
    request_id: string,
    audience_id: string,
  ): Promise<RequestVote | null> {
    const model = await this.prisma.requestVote.findUnique({
      where: {
        requestId_audienceId: {
          requestId: request_id,
          audienceId: audience_id,
        },
      },
    });
    return model ? RequestVoteModelMapper.toEntity(model) : null;
  }

  async countUpVotesByRequestId(request_id: string): Promise<number> {
    return this.prisma.requestVote.count({
      where: {
        requestId: request_id,
        voteType: RequestVoteType.UP,
      },
    });
  }

  getEntity(): new (...args: any[]) => RequestVote {
    return RequestVote;
  }

  private buildWhereClause(filter: RequestVoteFilter | null): any {
    if (!filter) return {};
    return {
      ...(filter.request_id && { requestId: filter.request_id }),
      ...(filter.audience_id && { audienceId: filter.audience_id }),
      ...(filter.vote_type && { voteType: filter.vote_type }),
    };
  }

  private buildOrderByClause(
    sort: string | null,
    sort_dir: string | null,
  ): any {
    if (!sort || !this.sortableFields.includes(sort)) {
      return { created_at: "desc" };
    }
    return { [sort]: sort_dir ?? "desc" };
  }
}
