import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";

import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../../../global-config";
import { AttendEventDto } from "../attend-event.dto";
import { MakeMusicRequestDto } from "../make-music-request.dto";

/**
 * `location` viaja ANINHADO no check-in e no pedido. Com `forbidNonWhitelisted`
 * (INP-1), campo aninhado sem metadata vira 422 no corpo inteiro — e o pedido
 * de música pararia de funcionar para todo mundo, não só para quem está longe.
 * O pipe é o de produção.
 */
const pipe = new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS);
const body = (metatype: ArgumentMetadata["metatype"]): ArgumentMetadata => ({
  type: "body",
  metatype,
});

const READING = {
  latitude: -22.9068,
  longitude: -43.1729,
  accuracy_m: 12.5,
  mocked: false,
};

describe("location aninhado (fronteira HTTP)", () => {
  it("aceita o corpo EXATO do pedido que o app manda", async () => {
    const result = await pipe.transform(
      {
        musician_id: "8e4b3c1e-1c1a-4f4e-9b8a-2f1a0c9d7e11",
        song_title: "Garota de Ipanema",
        artist_name: "Tom Jobim",
        event_id: "1b8c7d6e-5f4a-4b3c-8d2e-1f0a9b8c7d6e",
        location: READING,
      },
      body(MakeMusicRequestDto),
    );

    expect(result.location).toEqual(READING);
  });

  it("aceita o check-in com location", async () => {
    const result = await pipe.transform(
      {
        event_id: "1b8c7d6e-5f4a-4b3c-8d2e-1f0a9b8c7d6e",
        establishment_id: "2c9d8e7f-6a5b-4c4d-9e3f-2a1b0c9d8e7f",
        location: { latitude: 1, longitude: 2, accuracy_m: 30 },
      },
      body(AttendEventDto),
    );

    expect(result.location).toEqual({
      latitude: 1,
      longitude: 2,
      accuracy_m: 30,
    });
  });

  it("recusa latitude impossível", async () => {
    await expect(
      pipe.transform(
        {
          event_id: "1b8c7d6e-5f4a-4b3c-8d2e-1f0a9b8c7d6e",
          location: { ...READING, latitude: 123 },
        },
        body(AttendEventDto),
      ),
    ).rejects.toThrow();
  });

  it("recusa campo extra dentro de location (forbidNonWhitelisted alcança o aninhado)", async () => {
    await expect(
      pipe.transform(
        {
          event_id: "1b8c7d6e-5f4a-4b3c-8d2e-1f0a9b8c7d6e",
          location: { ...READING, verified: true },
        },
        body(AttendEventDto),
      ),
    ).rejects.toThrow();
  });
});
