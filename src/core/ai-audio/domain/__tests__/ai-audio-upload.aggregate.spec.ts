import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { AiAudioUpload } from "../ai-audio-upload.aggregate";

describe("AiAudioUpload Unit Tests", () => {
  test("should create an upload with default status", () => {
    const entity = AiAudioUpload.create({
      musician_id: new Uuid().id,
      original_filename: "song.mp3",
      content_type: "audio/mpeg",
      file_size: 123,
      object_key: "ai-audio/test/original.mp3",
      upload_method: "direct",
    });

    expect(entity.status).toBe("uploaded");
    expect(entity.notification.hasErrors()).toBe(false);
  });

  test("should mark rejected", () => {
    const entity = AiAudioUpload.create({
      musician_id: new Uuid().id,
      original_filename: "song.mp3",
      content_type: "audio/mpeg",
      file_size: 123,
      object_key: "ai-audio/test/original.mp3",
      upload_method: "direct",
    });

    entity.markRejected("invalid");
    expect(entity.status).toBe("rejected");
    expect(entity.rejected_reason).toBe("invalid");
  });
});
