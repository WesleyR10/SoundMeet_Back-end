import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { Campaign, CampaignId, CampaignStatus } from "../../../domain/campaign.aggregate";

export type CampaignModel = {
  id: string;
  establishment_id: string;
  title: string;
  description: string | null;
  start_date: Date;
  end_date: Date;
  target_genres: string[];
  status: string;
  created_at: Date;
  updated_at: Date;
};

export class CampaignModelMapper {
  static toModel(entity: Campaign): CampaignModel {
    return {
      id: entity.campaign_id.id,
      establishment_id: entity.establishment_id,
      title: entity.title,
      description: entity.description,
      start_date: entity.start_date,
      end_date: entity.end_date,
      target_genres: entity.target_genres,
      status: entity.status,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: CampaignModel): Campaign {
    try {
      return new Campaign({
        campaign_id: new CampaignId(model.id),
        establishment_id: model.establishment_id,
        title: model.title,
        description: model.description,
        start_date: model.start_date,
        end_date: model.end_date,
        target_genres: model.target_genres,
        status: model.status as CampaignStatus,
        created_at: model.created_at,
        updated_at: model.updated_at,
      });
    } catch (e) {
      throw new LoadEntityError([{ campaign: [(e as Error).message] }]);
    }
  }
}
