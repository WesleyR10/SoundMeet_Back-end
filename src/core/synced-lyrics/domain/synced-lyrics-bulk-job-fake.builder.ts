import { Chance } from "chance";

import { Uuid } from "../../shared/domain";
import { InvariantViolationError } from "../../shared/domain/errors/invariant-violation.error";
import {
  SyncedLyricsBulkJob,
  SyncedLyricsBulkJobId,
  SyncedLyricsBulkJobStatus,
} from "./synced-lyrics-bulk-job.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

export class SyncedLyricsBulkJobFakeBuilder<TBuild = any> {
  private _synced_lyrics_bulk_job_id: PropOrFactory<SyncedLyricsBulkJobId> = (
    _index,
  ) => new SyncedLyricsBulkJobId();
  private _musician_id: PropOrFactory<Uuid> = (_index) => new Uuid();
  private _status: PropOrFactory<SyncedLyricsBulkJobStatus> = (_index) =>
    "queued";
  private _total: PropOrFactory<number> = (_index) =>
    this.chance.integer({ min: 1, max: 100 });
  private _processed: PropOrFactory<number> = (_index) => 0;
  private _success: PropOrFactory<number> = (_index) => 0;
  private _failed: PropOrFactory<number> = (_index) => 0;

  private countObjs;
  private chance: Chance.Chance;

  static aJob() {
    return new SyncedLyricsBulkJobFakeBuilder<SyncedLyricsBulkJob>();
  }

  static theJobs(countObjs: number) {
    return new SyncedLyricsBulkJobFakeBuilder<SyncedLyricsBulkJob[]>(countObjs);
  }

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withJobId(valueOrFactory: PropOrFactory<SyncedLyricsBulkJobId>) {
    this._synced_lyrics_bulk_job_id = valueOrFactory;
    return this;
  }

  withMusicianId(valueOrFactory: PropOrFactory<Uuid>) {
    this._musician_id = valueOrFactory;
    return this;
  }

  withStatus(valueOrFactory: PropOrFactory<SyncedLyricsBulkJobStatus>) {
    this._status = valueOrFactory;
    return this;
  }

  withTotal(valueOrFactory: PropOrFactory<number>) {
    this._total = valueOrFactory;
    return this;
  }

  withProcessed(valueOrFactory: PropOrFactory<number>) {
    this._processed = valueOrFactory;
    return this;
  }

  withSuccess(valueOrFactory: PropOrFactory<number>) {
    this._success = valueOrFactory;
    return this;
  }

  withFailed(valueOrFactory: PropOrFactory<number>) {
    this._failed = valueOrFactory;
    return this;
  }

  build(): TBuild {
    const items = new Array(this.countObjs).fill(undefined).map((_, index) => {
      const entity = new SyncedLyricsBulkJob({
        synced_lyrics_bulk_job_id: this.callFactory(
          this._synced_lyrics_bulk_job_id,
          index,
        ),
        musician_id: this.callFactory(this._musician_id, index).id,
        status: this.callFactory(this._status, index),
        total: this.callFactory(this._total, index),
        processed: this.callFactory(this._processed, index),
        success: this.callFactory(this._success, index),
        failed: this.callFactory(this._failed, index),
      });
      entity.validate();
      return entity;
    });

    return this.countObjs === 1 ? (items[0] as any) : (items as any);
  }

  get job_id() {
    return this.getValue("synced_lyrics_bulk_job_id");
  }

  private getValue(prop: any) {
    const privateProp = `_${prop}` as keyof this;
    if (!this[privateProp]) {
      throw new InvariantViolationError(
        `Property ${prop} not have a factory, use 'with' methods`,
      );
    }
    return this.callFactory(this[privateProp] as any, 0);
  }

  private callFactory<T>(factoryOrValue: PropOrFactory<T>, index: number): T {
    return typeof factoryOrValue === "function"
      ? (factoryOrValue as any)(index)
      : factoryOrValue;
  }
}
