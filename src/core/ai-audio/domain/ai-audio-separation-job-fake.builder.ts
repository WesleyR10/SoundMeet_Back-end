import { Chance } from "chance";

import {
  FakeBuilderBase,
  PropOrFactory,
} from "../../shared/domain/testing/fake-builder";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import {
  AiAudioSeparationJob,
  AiAudioSeparationJobId,
  AiAudioSeparationJobStatus,
} from "./ai-audio-separation-job.aggregate";
import { AiAudioSeparationOutput } from "./ai-audio-separation-output.child-entity";

export class AiAudioSeparationJobFakeBuilder<
  TBuild = any,
> extends FakeBuilderBase {
  private _ai_audio_separation_job_id:
    | PropOrFactory<AiAudioSeparationJobId>
    | undefined = undefined;
  private _ai_audio_upload_id: PropOrFactory<string> = (_index) =>
    new Uuid().id;
  private _musician_id: PropOrFactory<string> = (_index) => new Uuid().id;
  private _model_id: PropOrFactory<string> = (_index) => "htdemucs_4stems";
  private _output_prefix: PropOrFactory<string> = (_index) =>
    `ai-audio/${new Uuid().id}/separations/${new Uuid().id}`;
  private _status: PropOrFactory<AiAudioSeparationJobStatus> = (_index) =>
    "queued";
  private _error_code: PropOrFactory<string | null> = (_index) => null;
  private _error_message: PropOrFactory<string | null> = (_index) => null;
  private _started_at: PropOrFactory<Date | null> = (_index) => null;
  private _finished_at: PropOrFactory<Date | null> = (_index) => null;
  private _outputs: PropOrFactory<AiAudioSeparationOutput[]> = (_index) => [];
  private _created_at: PropOrFactory<Date> = (_index) => new Date();
  private _updated_at: PropOrFactory<Date> = (_index) => new Date();

  private chance: Chance.Chance;

  static aJob() {
    return new AiAudioSeparationJobFakeBuilder<AiAudioSeparationJob>();
  }

  static theJobs(countObjs: number) {
    return new AiAudioSeparationJobFakeBuilder<AiAudioSeparationJob[]>(
      countObjs,
    );
  }

  private constructor(countObjs: number = 1) {
    super(countObjs);
    this.chance = Chance();
  }

  withId(valueOrFactory: PropOrFactory<AiAudioSeparationJobId>) {
    this._ai_audio_separation_job_id = valueOrFactory;
    return this;
  }

  withUploadId(valueOrFactory: PropOrFactory<string | Uuid>) {
    this._ai_audio_upload_id =
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

  withOutputPrefix(valueOrFactory: PropOrFactory<string>) {
    this._output_prefix = valueOrFactory;
    return this;
  }

  withStatus(valueOrFactory: PropOrFactory<AiAudioSeparationJobStatus>) {
    this._status = valueOrFactory;
    return this;
  }

  completed() {
    this._status = () => "completed";
    this._started_at = () => new Date(Date.now() - 1000);
    this._finished_at = () => new Date();
    this._outputs = () => [
      new AiAudioSeparationOutput({
        stem_name: "vocals",
        object_key: `ai-audio/${new Uuid().id}/vocals.wav`,
        content_type: "audio/wav",
        file_size: 123,
      }),
    ];
    return this;
  }

  failed() {
    this._status = () => "failed";
    this._started_at = () => new Date(Date.now() - 1000);
    this._finished_at = () => new Date();
    this._error_code = () => "SEPARATION_FAILED";
    this._error_message = () => this.chance.sentence({ words: 6 });
    return this;
  }

  build(): TBuild {
    const jobs = new Array(this.countObjs).fill(undefined).map((_, index) => {
      const job = new AiAudioSeparationJob({
        ai_audio_separation_job_id: !this._ai_audio_separation_job_id
          ? undefined
          : this.callFactory(this._ai_audio_separation_job_id, index),
        ai_audio_upload_id: this.callFactory(this._ai_audio_upload_id, index),
        musician_id: this.callFactory(this._musician_id, index),
        model_id: this.callFactory(this._model_id, index),
        output_prefix: this.callFactory(this._output_prefix, index),
        status: this.callFactory(this._status, index),
        error_code: this.callFactory(this._error_code, index),
        error_message: this.callFactory(this._error_message, index),
        started_at: this.callFactory(this._started_at, index),
        finished_at: this.callFactory(this._finished_at, index),
        outputs: this.callFactory(this._outputs, index),
        created_at: this.callFactory(this._created_at, index),
        updated_at: this.callFactory(this._updated_at, index),
      });

      job.validate();
      return job;
    });

    return (this.countObjs === 1 ? jobs[0] : jobs) as any;
  }
}
