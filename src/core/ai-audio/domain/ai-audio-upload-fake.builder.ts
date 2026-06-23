import { Chance } from "chance";

import {
  FakeBuilderBase,
  PropOrFactory,
} from "../../shared/domain/testing/fake-builder";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import {
  AiAudioUpload,
  AiAudioUploadId,
  AiAudioUploadStatus,
} from "./ai-audio-upload.aggregate";

export class AiAudioUploadFakeBuilder<TBuild = any> extends FakeBuilderBase {
  private _ai_audio_upload_id: PropOrFactory<AiAudioUploadId> | undefined =
    undefined;
  private _musician_id: PropOrFactory<string> = (_index) => new Uuid().id;
  private _original_filename: PropOrFactory<string> = (_index) => "song.mp3";
  private _content_type: PropOrFactory<string> = (_index) => "audio/mpeg";
  private _file_size: PropOrFactory<number> = (_index) => 1024 * 1024;
  private _object_key: PropOrFactory<string> = (_index) =>
    `ai-audio/${new Uuid().id}/original.mp3`;
  private _upload_method: PropOrFactory<"direct" | "presigned" | "multipart"> =
    (_index) => "direct";
  private _multipart_upload_id: PropOrFactory<string | null> = (_index) => null;
  private _status: PropOrFactory<AiAudioUploadStatus> = (_index) => "uploaded";
  private _rejected_reason: PropOrFactory<string | null> = (_index) => null;
  private _created_at: PropOrFactory<Date> = (_index) => new Date();
  private _updated_at: PropOrFactory<Date> = (_index) => new Date();

  private chance: Chance.Chance;

  static anUpload() {
    return new AiAudioUploadFakeBuilder<AiAudioUpload>();
  }

  static theUploads(countObjs: number) {
    return new AiAudioUploadFakeBuilder<AiAudioUpload[]>(countObjs);
  }

  private constructor(countObjs: number = 1) {
    super(countObjs);
    this.chance = Chance();
  }

  withId(valueOrFactory: PropOrFactory<AiAudioUploadId>) {
    this._ai_audio_upload_id = valueOrFactory;
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

  withOriginalFilename(valueOrFactory: PropOrFactory<string>) {
    this._original_filename = valueOrFactory;
    return this;
  }

  withContentType(valueOrFactory: PropOrFactory<string>) {
    this._content_type = valueOrFactory;
    return this;
  }

  withFileSize(valueOrFactory: PropOrFactory<number>) {
    this._file_size = valueOrFactory;
    return this;
  }

  withObjectKey(valueOrFactory: PropOrFactory<string>) {
    this._object_key = valueOrFactory;
    return this;
  }

  withUploadMethod(
    valueOrFactory: PropOrFactory<"direct" | "presigned" | "multipart">,
  ) {
    this._upload_method = valueOrFactory;
    return this;
  }

  withMultipartUploadId(valueOrFactory: PropOrFactory<string | null>) {
    this._multipart_upload_id = valueOrFactory;
    return this;
  }

  withStatus(valueOrFactory: PropOrFactory<AiAudioUploadStatus>) {
    this._status = valueOrFactory;
    return this;
  }

  rejected() {
    this._status = () => "rejected";
    this._rejected_reason = () => this.chance.sentence({ words: 4 });
    return this;
  }

  build(): TBuild {
    const uploads = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const upload = new AiAudioUpload({
          ai_audio_upload_id: !this._ai_audio_upload_id
            ? undefined
            : this.callFactory(this._ai_audio_upload_id, index),
          musician_id: this.callFactory(this._musician_id, index),
          original_filename: this.callFactory(this._original_filename, index),
          content_type: this.callFactory(this._content_type, index),
          file_size: this.callFactory(this._file_size, index),
          object_key: this.callFactory(this._object_key, index),
          upload_method: this.callFactory(this._upload_method, index),
          multipart_upload_id: this.callFactory(
            this._multipart_upload_id,
            index,
          ),
          status: this.callFactory(this._status, index),
          rejected_reason: this.callFactory(this._rejected_reason, index),
          created_at: this.callFactory(this._created_at, index),
          updated_at: this.callFactory(this._updated_at, index),
        });

        upload.validate();
        return upload;
      });

    return (this.countObjs === 1 ? uploads[0] : uploads) as any;
  }
}
