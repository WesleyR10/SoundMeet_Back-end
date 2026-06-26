import { PrismaClient } from "@prisma/client";

import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { mapPrismaErrorToDomainError } from "../../../../shared/infra/db/prisma/prisma-error.mapper";
import { Campaign, CampaignId } from "../../../domain/campaign.aggregate";
import {
  CampaignFilter,
  CampaignSearchParams,
  CampaignSearchResult,
  ICampaignRepository,
} from "../../../domain/campaign.repository";
import { CampaignModel, CampaignModelMapper } from "./campaign-model-mapper";

export class CampaignPrismaRepository implements ICampaignRepository {
  sortableFields: string[] = ["title", "start_date", "created_at"];

  constructor(private prisma: PrismaClient) {}

  async insert(entity: Campaign): Promise<void> {
    try {
      await this.prisma.campaign.create({
        data: CampaignModelMapper.toModel(entity),
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.campaign_id.id,
        operation: "campaign.create",
      });
    }
  }

  async bulkInsert(entities: Campaign[]): Promise<void> {
    const models = entities.map(CampaignModelMapper.toModel);
    try {
      await this.prisma.campaign.createMany({ data: models });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: "bulk",
        operation: "campaign.bulkInsert",
      });
    }
  }

  async update(entity: Campaign): Promise<void> {
    const model = CampaignModelMapper.toModel(entity);
    try {
      await this.prisma.campaign.update({
        where: { id: model.id },
        data: model,
      });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: entity.campaign_id.id,
        operation: "campaign.update",
      });
    }
  }

  async delete(id: CampaignId): Promise<void> {
    try {
      await this.prisma.campaign.delete({ where: { id: id.id } });
    } catch (error: any) {
      throw mapPrismaErrorToDomainError(error, {
        entityClass: this.getEntity(),
        id: id.id,
        operation: "campaign.delete",
      });
    }
  }

  async findById(id: CampaignId): Promise<Campaign | null> {
    const model = await this.prisma.campaign.findUnique({
      where: { id: id.id },
    });
    return model ? CampaignModelMapper.toEntity(model as CampaignModel) : null;
  }

  async findAll(): Promise<Campaign[]> {
    const models = await this.prisma.campaign.findMany();
    return models.map((m) => CampaignModelMapper.toEntity(m as CampaignModel));
  }

  async findByIds(ids: CampaignId[]): Promise<Campaign[]> {
    const models = await this.prisma.campaign.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
    });
    return models.map((m) => CampaignModelMapper.toEntity(m as CampaignModel));
  }

  async existsById(
    ids: CampaignId[],
  ): Promise<{ exists: CampaignId[]; not_exists: CampaignId[] }> {
    const found = await this.prisma.campaign.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
      select: { id: true },
    });
    const foundSet = new Set(found.map((r) => r.id));
    return {
      exists: ids.filter((id) => foundSet.has(id.id)),
      not_exists: ids.filter((id) => !foundSet.has(id.id)),
    };
  }

  async findByEstablishmentId(establishment_id: string): Promise<Campaign[]> {
    const models = await this.prisma.campaign.findMany({
      where: { establishment_id },
    });
    return models.map((m) => CampaignModelMapper.toEntity(m as CampaignModel));
  }

  async search(params: CampaignSearchParams): Promise<CampaignSearchResult> {
    const offset = (params.page - 1) * params.per_page;
    const where: any = {};

    if (params.filter?.establishment_id) {
      where.establishment_id = params.filter.establishment_id;
    }
    if (params.filter?.status) {
      where.status = params.filter.status;
    }
    if (params.filter?.title) {
      where.title = { contains: params.filter.title, mode: "insensitive" };
    }

    const sortField =
      params.sort && this.sortableFields.includes(params.sort)
        ? params.sort
        : "created_at";
    const sortDir = params.sort_dir ?? "desc";

    const [total, models] = await this.prisma.$transaction([
      this.prisma.campaign.count({ where }),
      this.prisma.campaign.findMany({
        where,
        skip: offset,
        take: params.per_page,
        orderBy: { [sortField]: sortDir },
      }),
    ]);

    return new CampaignSearchResult({
      items: models.map((m) => CampaignModelMapper.toEntity(m as CampaignModel)),
      total,
      current_page: params.page,
      per_page: params.per_page,
    });
  }

  getEntity(): new (...args: any[]) => Campaign {
    return Campaign;
  }
}
