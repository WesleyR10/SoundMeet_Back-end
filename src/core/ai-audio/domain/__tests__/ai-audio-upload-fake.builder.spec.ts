import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { AiAudioUploadId } from "../ai-audio-upload.aggregate";
import { AiAudioUploadFakeBuilder } from "../ai-audio-upload-fake.builder";

describe("AiAudioUploadFakeBuilder Unit Tests", () => {
  test("should build a valid upload", () => {
    const upload = AiAudioUploadFakeBuilder.anUpload().build();
    expect(upload.ai_audio_upload_id).toBeInstanceOf(AiAudioUploadId);
    expect(upload.musician_id).toBeInstanceOf(Uuid);
    expect(upload.notification.hasErrors()).toBe(false);
  });

  test("should build many uploads", () => {
    const uploads = AiAudioUploadFakeBuilder.theUploads(2).build();
    expect(uploads).toHaveLength(2);
  });
});
