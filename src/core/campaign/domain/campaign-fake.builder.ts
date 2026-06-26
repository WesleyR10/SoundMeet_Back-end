import { Chance } from "chance";

import { Campaign, CampaignId } from "./campaign.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class CampaignFakeBuilder<TBuild = any> {
  private _campaign_id: PropOrFactory<CampaignId | undefined> = undefined;
  private _establishment_id: PropOrFactory<string> = () =>
    this.chance.guid({ version: 4 });
  private _title: PropOrFactory<string> = (i) => `Campaign ${i}`;
  private _description: PropOrFactory<string | null> = null;
  private _start_date: PropOrFactory<Date> = () => new Date();
  private _end_date: PropOrFactory<Date> = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  };
  private _target_genres: PropOrFactory<string[]> = () => ["samba", "rock"];
  private _count: number;
  private chance: Chance.Chance;
  private countObjs: number;

  static aCampaign() {
    return new CampaignFakeBuilder<Campaign>();
  }

  static theCampaigns(count: number) {
    return new CampaignFakeBuilder<Campaign[]>(count);
  }

  private constructor(count: number = 1) {
    this._count = count;
    this.countObjs = count;
    this.chance = new Chance();
  }

  withCampaignId(value: PropOrFactory<CampaignId>) {
    this._campaign_id = value;
    return this;
  }

  withEstablishmentId(value: PropOrFactory<string>) {
    this._establishment_id = value;
    return this;
  }

  withTitle(value: PropOrFactory<string>) {
    this._title = value;
    return this;
  }

  withDescription(value: PropOrFactory<string | null>) {
    this._description = value;
    return this;
  }

  withStartDate(value: PropOrFactory<Date>) {
    this._start_date = value;
    return this;
  }

  withEndDate(value: PropOrFactory<Date>) {
    this._end_date = value;
    return this;
  }

  withTargetGenres(value: PropOrFactory<string[]>) {
    this._target_genres = value;
    return this;
  }

  build(): TBuild {
    const campaigns = new Array(this.countObjs).fill(undefined).map(
      (_, i) =>
        new Campaign({
          campaign_id: this._call(this._campaign_id, i),
          establishment_id: this._call(this._establishment_id, i),
          title: this._call(this._title, i),
          description: this._call(this._description, i),
          start_date: this._call(this._start_date, i),
          end_date: this._call(this._end_date, i),
          target_genres: this._call(this._target_genres, i),
        }),
    );
    return (this.countObjs === 1 ? campaigns[0] : campaigns) as TBuild;
  }

  private _call<T>(prop: PropOrFactory<T>, index: number): T {
    return typeof prop === "function"
      ? (prop as (index: number) => T)(index)
      : prop;
  }
}
