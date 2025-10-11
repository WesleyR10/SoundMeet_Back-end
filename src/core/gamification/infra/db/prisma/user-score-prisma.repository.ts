import { PrismaClient } from '@prisma/client';
import { UserScore, UserScoreId } from '../../../domain/user-score.aggregate';
import { IUserScoreRepository } from '../../../domain/user-score.repository';
import { UserScoreModelMapper, UserScoreModelProps } from './user-score-model-mapper';
import { UserScoreSearchParams, UserScoreSearchResult } from '../../../domain/user-score.repository';
import { NotFoundError } from '../../../../shared/domain/errors/not-found.error';

export class UserScorePrismaRepository implements IUserScoreRepository {
  sortableFields: string[] = ['created_at', 'points'];

  constructor(private prismaClient: PrismaClient) {}

  async insert(entity: UserScore): Promise<void> {
    const modelProps = UserScoreModelMapper.toModel(entity);
    await this.prismaClient.userScore.create({
      data: modelProps,
    });
  }

  async bulkInsert(entities: UserScore[]): Promise<void> {
    const modelsProps = entities.map((entity) =>
      UserScoreModelMapper.toModel(entity),
    );
    await this.prismaClient.userScore.createMany({
      data: modelsProps,
    });
  }

  async update(entity: UserScore): Promise<void> {
    const id = entity.id.id;
    const modelProps = UserScoreModelMapper.toModel(entity);
    await this.getEntityModel(id);
    await this.prismaClient.userScore.update({
      where: { id },
      data: modelProps,
    });
  }

  async delete(entity_id: UserScoreId): Promise<void> {
    const id = entity_id.id;
    await this.getEntityModel(id);
    await this.prismaClient.userScore.delete({
      where: { id },
    });
  }

  async findById(entity_id: UserScoreId): Promise<UserScore | null> {
    const model = await this.prismaClient.userScore.findUnique({
      where: { id: entity_id.id },
    });
    return model ? UserScoreModelMapper.toEntity(model) : null;
  }

  async findByIds(ids: UserScoreId[]): Promise<UserScore[]> {
    const models = await this.prismaClient.userScore.findMany({
      where: { id: { in: ids.map((id) => id.id) } },
    });
    return models.map((model) => UserScoreModelMapper.toEntity(model));
  }

  async existsById(ids: UserScoreId[]): Promise<{
    exists: UserScoreId[];
    not_exists: UserScoreId[];
  }> {
    const idsValue = ids.map((id) => id.id);
    const models = await this.prismaClient.userScore.findMany({
      where: { id: { in: idsValue } },
      select: { id: true },
    });
    const existsIds = models.map((model) => model.id);
    const existsUserScoreIds = existsIds.map((id) => new UserScoreId(id));
    const notExistsUserScoreIds = ids.filter(
      (id) => !existsIds.includes(id.id),
    );
    return {
      exists: existsUserScoreIds,
      not_exists: notExistsUserScoreIds,
    };
  }

  async search(props: UserScoreSearchParams): Promise<UserScoreSearchResult> {
    const offset = (props.page - 1) * props.per_page;
    const limit = props.per_page;

    const { where, orderBy } = this.formatQuery(props);

    const [models, count] = await Promise.all([
      this.prismaClient.userScore.findMany({
        ...(where && { where }),
        ...(orderBy && { orderBy }),
        skip: offset,
        take: limit,
      }),
      this.prismaClient.userScore.count({
        ...(where && { where }),
      }),
    ]);

    const entities = models.map((model) => UserScoreModelMapper.toEntity(model));

    return new UserScoreSearchResult({
      items: entities,
      current_page: props.page,
      per_page: props.per_page,
      total: count,
    });
  }

  async findByUserAndType(userId: string, scoreType: string): Promise<UserScore[]> {
    const models = await this.prismaClient.userScore.findMany({
      where: {
        user_id: userId,
        score_type: scoreType,
      },
      orderBy: { created_at: 'desc' },
    });
    return models.map((model) => UserScoreModelMapper.toEntity(model));
  }

  async getTotalPointsByUser(userId: string): Promise<number> {
    const result = await this.prismaClient.userScore.aggregate({
      where: { user_id: userId },
      _sum: { points: true },
    });
    return result._sum.points || 0;
  }

  async getPointsByUserAndType(userId: string, scoreType: string): Promise<number> {
    const result = await this.prismaClient.userScore.aggregate({
      where: {
        user_id: userId,
        score_type: scoreType,
      },
      _sum: { points: true },
    });
    return result._sum.points || 0;
  }

  async findAll(): Promise<UserScore[]> {
    const models = await this.prismaClient.userScore.findMany();
    return models.map((model) => UserScoreModelMapper.toEntity(model));
  }

  getEntity(): new (...args: any[]) => UserScore {
    return UserScore;
  }

  private async getEntityModel(id: string): Promise<UserScoreModelProps> {
    const model = await this.prismaClient.userScore.findUnique({
      where: { id },
    });
    if (!model) {
      throw new NotFoundError(id, UserScore);
    }
    return model;
  }

  private formatQuery(props: UserScoreSearchParams) {
    let where: any = {};
    let orderBy: any = {};

    if (props.filter) {
      if (props.filter.user_id) {
        where.user_id = props.filter.user_id;
      }
      if (props.filter.score_type) {
        where.score_type = props.filter.score_type;
      }
    }

    if (props.sort && this.sortableFields.includes(props.sort)) {
      orderBy[props.sort] = props.sort_dir || 'asc';
    } else {
      orderBy.created_at = 'desc';
    }

    return { where, orderBy };
  }
}
