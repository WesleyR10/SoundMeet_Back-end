import { Chance } from "chance";

import { Indication, IndicationId } from "./indication.aggregate";
import { IndicationStatus } from "./indication-types";

type PropOrFactory<T> = T | ((index: number) => T);

export class IndicationFakeBuilder<TBuild = any> {
  private _indication_id: PropOrFactory<IndicationId | undefined> = undefined;
  private _audience_id: PropOrFactory<string> = () =>
    this.chance.guid({ version: 4 });
  private _musician_id: PropOrFactory<string> = () =>
    this.chance.guid({ version: 4 });
  private _establishment_id: PropOrFactory<string> = () =>
    this.chance.guid({ version: 4 });
  private _message: PropOrFactory<string | null> = null;
  private _status: PropOrFactory<IndicationStatus> = "new";
  private _count: number;
  private chance: Chance.Chance;
  private countObjs: number;

  static anIndication() {
    return new IndicationFakeBuilder<Indication>();
  }

  static theIndications(count: number) {
    return new IndicationFakeBuilder<Indication[]>(count);
  }

  private constructor(count: number = 1) {
    this._count = count;
    this.countObjs = count;
    this.chance = new Chance();
  }

  withIndicationId(value: PropOrFactory<IndicationId>) {
    this._indication_id = value;
    return this;
  }

  withAudienceId(value: PropOrFactory<string>) {
    this._audience_id = value;
    return this;
  }

  withMusicianId(value: PropOrFactory<string>) {
    this._musician_id = value;
    return this;
  }

  withEstablishmentId(value: PropOrFactory<string>) {
    this._establishment_id = value;
    return this;
  }

  withMessage(value: PropOrFactory<string | null>) {
    this._message = value;
    return this;
  }

  withStatus(value: PropOrFactory<IndicationStatus>) {
    this._status = value;
    return this;
  }

  build(): TBuild {
    const indications = new Array(this.countObjs).fill(undefined).map(
      (_, i) =>
        new Indication({
          indication_id: this._call(this._indication_id, i),
          audience_id: this._call(this._audience_id, i),
          musician_id: this._call(this._musician_id, i),
          establishment_id: this._call(this._establishment_id, i),
          message: this._call(this._message, i),
          status: this._call(this._status, i),
        }),
    );
    return (this.countObjs === 1 ? indications[0] : indications) as TBuild;
  }

  private _call<T>(prop: PropOrFactory<T>, index: number): T {
    return typeof prop === "function"
      ? (prop as (index: number) => T)(index)
      : prop;
  }
}
