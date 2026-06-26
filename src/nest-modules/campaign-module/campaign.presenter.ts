import { ApiProperty } from "@nestjs/swagger";

import { CampaignOutput } from "../../core/campaign/application/use-cases/common/campaign-output";
import { PaginationOutput } from "../../core/shared/application/pagination-output";
import { CollectionPresenter } from "../shared-module/collection.presenter";

export class CampaignPresenter {
  @ApiProperty({ example: "uuid-v4" })
  campaign_id: string;

  @ApiProperty()
  establishment_id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty()
  start_date: Date;

  @ApiProperty()
  end_date: Date;

  @ApiProperty({ isArray: true, example: ["samba", "rock"] })
  target_genres: string[];

  @ApiProperty({ example: "draft" })
  status: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;

  constructor(output: CampaignOutput) {
    this.campaign_id = output.campaign_id;
    this.establishment_id = output.establishment_id;
    this.title = output.title;
    this.description = output.description;
    this.start_date = output.start_date;
    this.end_date = output.end_date;
    this.target_genres = output.target_genres;
    this.status = output.status;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

export class CampaignCollectionPresenter extends CollectionPresenter {
  @ApiProperty({ type: [CampaignPresenter] })
  data: CampaignPresenter[];

  constructor(output: PaginationOutput<CampaignOutput>) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new CampaignPresenter(i));
  }
}
