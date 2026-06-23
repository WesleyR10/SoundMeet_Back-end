import { Chance } from "chance";

import {
  FakeBuilderBase,
  PropOrFactory,
} from "../../shared/domain/testing/fake-builder";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import {
  AiCifraAnalysisJob,
  AiCifraAnalysisJobId,
  AiCifraAnalysisJobStatus,
  AiCifraAnalysisResult,
} from "./ai-cifra-analysis-job.aggregate";

export class AiCifraAnalysisJobFakeBuilder<
  TBuild = any,
> extends FakeBuilderBase {
  private _ai_cifra_analysis_job_id:
    | PropOrFactory<AiCifraAnalysisJobId>
    | undefined = undefined;
  private _ai_cifra_upload_id: PropOrFactory<string> = (_index) =>
    new Uuid().id;
  private _musician_id: PropOrFactory<string> = (_index) => new Uuid().id;
  private _model_id: PropOrFactory<string> = (_index) => "crema_v1";
  private _status: PropOrFactory<AiCifraAnalysisJobStatus> = (_index) =>
    "queued";
  private _progress_percent: PropOrFactory<number> = (_index) => 0;
  private _progress_stage: PropOrFactory<string | null> = (_index) => null;
  private _error_code: PropOrFactory<string | null> = (_index) => null;
  private _error_message: PropOrFactory<string | null> = (_index) => null;
  private _started_at: PropOrFactory<Date | null> = (_index) => null;
  private _finished_at: PropOrFactory<Date | null> = (_index) => null;
  private _result: PropOrFactory<AiCifraAnalysisResult | null> = (_index) =>
    null;
  private _created_at: PropOrFactory<Date> = (_index) => new Date();
  private _updated_at: PropOrFactory<Date> = (_index) => new Date();

  private chance: Chance.Chance;

  static aJob() {
    return new AiCifraAnalysisJobFakeBuilder<AiCifraAnalysisJob>();
  }

  static theJobs(countObjs: number) {
    return new AiCifraAnalysisJobFakeBuilder<AiCifraAnalysisJob[]>(countObjs);
  }

  private constructor(countObjs: number = 1) {
    super(countObjs);
    this.chance = Chance();
  }

  withId(valueOrFactory: PropOrFactory<AiCifraAnalysisJobId>) {
    this._ai_cifra_analysis_job_id = valueOrFactory;
    return this;
  }

  withUploadId(valueOrFactory: PropOrFactory<string | Uuid>) {
    this._ai_cifra_upload_id =
      typeof valueOrFactory === "function"
        ? (index: number) => {
            const result = valueOrFactory(index);
            return result instanceof Uuid ? result.id : result;
          }
        : valueOrFactory instanceof Uuid
          ? valueOrFactory.id
          : valueOrFactory;
    return this;
  }

  withMusicianId(valueOrFactory: PropOrFactory<string | Uuid>) {
    this._musician_id =
      typeof valueOrFactory === "function"
        ? (index: number) => {
            const result = valueOrFactory(index);
            return result instanceof Uuid ? result.id : result;
          }
        : valueOrFactory instanceof Uuid
          ? valueOrFactory.id
          : valueOrFactory;
    return this;
  }

  withModelId(valueOrFactory: PropOrFactory<string>) {
    this._model_id = valueOrFactory;
    return this;
  }

  withStatus(valueOrFactory: PropOrFactory<AiCifraAnalysisJobStatus>) {
    this._status = valueOrFactory;
    return this;
  }

  failed() {
    this._status = () => "failed";
    this._error_code = () => "ANALYSIS_FAILED";
    this._error_message = () => this.chance.sentence({ words: 6 });
    this._finished_at = () => new Date();
    this._progress_stage = () => "failed";
    return this;
  }

  completed() {
    this._status = () => "completed";
    this._progress_percent = () => 100;
    this._progress_stage = () => "completed";
    this._finished_at = () => new Date();
    this._result = () =>
      new AiCifraAnalysisResult({
        bpm: 120,
        key: "C",
        time_signature: "4/4",
        chords: [
          { start_seconds: 0, end_seconds: 2, chord: "C", confidence: 0.9 },
        ],
        segments: [{ start_seconds: 0, end_seconds: 2, label: "intro" }],
      });
    return this;
  }

  build(): TBuild {
    const jobs = new Array(this.countObjs).fill(undefined).map((_, index) => {
      const job = new AiCifraAnalysisJob({
        ai_cifra_analysis_job_id: !this._ai_cifra_analysis_job_id
          ? undefined
          : this.callFactory(this._ai_cifra_analysis_job_id, index),
        ai_cifra_upload_id: this.callFactory(this._ai_cifra_upload_id, index),
        musician_id: this.callFactory(this._musician_id, index),
        model_id: this.callFactory(this._model_id, index),
        status: this.callFactory(this._status, index),
        progress_percent: this.callFactory(this._progress_percent, index),
        progress_stage: this.callFactory(this._progress_stage, index),
        error_code: this.callFactory(this._error_code, index),
        error_message: this.callFactory(this._error_message, index),
        started_at: this.callFactory(this._started_at, index),
        finished_at: this.callFactory(this._finished_at, index),
        result: this.callFactory(this._result, index),
        created_at: this.callFactory(this._created_at, index),
        updated_at: this.callFactory(this._updated_at, index),
      });

      job.validate();
      return job;
    });

    return (this.countObjs === 1 ? jobs[0] : jobs) as any;
  }
}
