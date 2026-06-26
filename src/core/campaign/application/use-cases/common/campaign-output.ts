import { Campaign } from "../../../domain/campaign.aggregate";

export type CampaignOutput = {
  campaign_id: string;
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

export class CampaignOutputMapper {
  static toOutput(entity: Campaign): CampaignOutput {
    return {
      campaign_id: entity.campaign_id.id,
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
}
