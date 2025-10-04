import { Request } from "../../../../domain/request.aggregate";
import { RequestInMemoryRepository } from "../request-in-memory.repository";
import { RequestStatus } from "../../../../domain/value-objects/request-status.vo";
import { SongTitle } from "../../../../domain/value-objects/song-title.vo";
import { RequestMessage } from "../../../../domain/value-objects/request-message.vo";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";

describe("RequestInMemoryRepository", () => {
  let repository: RequestInMemoryRepository;

  beforeEach(() => (repository = new RequestInMemoryRepository()));

  it("should no filter items when filter object is null", async () => {
    const items = [Request.fake().aRequest().build()];
    const filterSpy = jest.spyOn(items, "filter" as any);

    const itemsFiltered = await repository["applyFilter"](items, null);
    expect(filterSpy).not.toHaveBeenCalled();
    expect(itemsFiltered).toStrictEqual(items);
  });

  it("should filter items using audience_id parameter", async () => {
    const audienceId1 = new Uuid();
    const audienceId2 = new Uuid();

    const items = [
      Request.fake().aRequest().withAudienceId(audienceId1.id).build(),
      Request.fake().aRequest().withAudienceId(audienceId2.id).build(),
      Request.fake().aRequest().withAudienceId(audienceId1.id).build(),
    ];

    const itemsFiltered = await repository["applyFilter"](items, {
      audience_id: audienceId1.id,
    });
    expect(itemsFiltered).toStrictEqual([items[0], items[2]]);
  });

  it("should filter items using musician_id parameter", async () => {
    const musicianId1 = new Uuid();
    const musicianId2 = new Uuid();

    const items = [
      Request.fake().aRequest().withMusicianId(musicianId1.id).build(),
      Request.fake().aRequest().withMusicianId(musicianId2.id).build(),
      Request.fake().aRequest().withMusicianId(musicianId1.id).build(),
    ];

    const itemsFiltered = await repository["applyFilter"](items, {
      musician_id: musicianId1.id,
    });
    expect(itemsFiltered).toStrictEqual([items[0], items[2]]);
  });

  it("should filter items using status parameter", async () => {
    const items = [
      Request.fake().aRequest().pending().build(),
      Request.fake().aRequest().accepted().build(),
      Request.fake().aRequest().pending().build(),
    ];

    const itemsFiltered = await repository["applyFilter"](items, {
      status: RequestStatus.pending().value,
    });
    expect(itemsFiltered).toStrictEqual([items[0], items[2]]);
  });

  it("should filter items using song_title parameter", async () => {
    const items = [
      Request.fake().aRequest().withSongTitle("Bohemian Rhapsody").build(),
      Request.fake().aRequest().withSongTitle("Stairway to Heaven").build(),
      Request.fake().aRequest().withSongTitle("Hotel California").build(),
    ];

    const itemsFiltered = await repository["applyFilter"](items, {
      song_title: "heaven",
    });
    expect(itemsFiltered).toStrictEqual([items[1]]);
  });

  it("should filter items using artist parameter", async () => {
    const items = [
      Request.fake().aRequest().withArtist("Queen").build(),
      Request.fake().aRequest().withArtist("Led Zeppelin").build(),
      Request.fake().aRequest().withArtist("Eagles").build(),
    ];

    const itemsFiltered = await repository["applyFilter"](items, {
      artist: "queen",
    });
    expect(itemsFiltered).toStrictEqual([items[0]]);
  });

  it("should filter items using created_after parameter", async () => {
    const baseDate = new Date("2023-01-01");
    const items = [
      Request.fake().aRequest().withCreatedAt(new Date("2022-12-31")).build(),
      Request.fake().aRequest().withCreatedAt(new Date("2023-01-02")).build(),
      Request.fake().aRequest().withCreatedAt(new Date("2023-01-03")).build(),
    ];

    const itemsFiltered = await repository["applyFilter"](items, {
      created_after: baseDate,
    });
    expect(itemsFiltered).toStrictEqual([items[1], items[2]]);
  });

  it("should filter items using created_before parameter", async () => {
    const baseDate = new Date("2023-01-02");
    const items = [
      Request.fake().aRequest().withCreatedAt(new Date("2023-01-01")).build(),
      Request.fake().aRequest().withCreatedAt(new Date("2023-01-02")).build(),
      Request.fake().aRequest().withCreatedAt(new Date("2023-01-03")).build(),
    ];

    const itemsFiltered = await repository["applyFilter"](items, {
      created_before: baseDate,
    });
    expect(itemsFiltered).toStrictEqual([items[0], items[1]]);
  });

  it("should filter items using multiple parameters", async () => {
    const audienceId = new Uuid();
    const musicianId = new Uuid();

    const items = [
      Request.fake()
        .aRequest()
        .withAudienceId(audienceId.id)
        .withMusicianId(musicianId.id)
        .withSongTitle("Bohemian Rhapsody")
        .withArtist("Queen")
        .pending()
        .build(),
      Request.fake()
        .aRequest()
        .withAudienceId(audienceId.id)
        .withMusicianId(musicianId.id)
        .withSongTitle("Stairway to Heaven")
        .withArtist("Led Zeppelin")
        .accepted()
        .build(),
      Request.fake()
        .aRequest()
        .withAudienceId(audienceId.id)
        .withMusicianId(musicianId.id)
        .withSongTitle("Hotel California")
        .withArtist("Eagles")
        .pending()
        .build(),
    ];

    const itemsFiltered = await repository["applyFilter"](items, {
      audience_id: audienceId.id,
      musician_id: musicianId.id,
      status: RequestStatus.pending().value,
      artist: "queen",
    });
    expect(itemsFiltered).toStrictEqual([items[0]]);
  });

  it("should sort by created_at when sort param is null", async () => {
    const created_at = new Date();

    const items = [
      Request.fake().aRequest().withCreatedAt(created_at).build(),
      Request.fake()
        .aRequest()
        .withCreatedAt(new Date(created_at.getTime() + 100))
        .build(),
      Request.fake()
        .aRequest()
        .withCreatedAt(new Date(created_at.getTime() + 200))
        .build(),
    ];

    const itemsSorted = repository["applySort"](items, null, null);
    expect(itemsSorted).toStrictEqual([items[2], items[1], items[0]]);
  });

  it("should sort by song_title", async () => {
    const items = [
      Request.fake().aRequest().withSongTitle("C Song").build(),
      Request.fake().aRequest().withSongTitle("B Song").build(),
      Request.fake().aRequest().withSongTitle("A Song").build(),
    ];

    let itemsSorted = repository["applySort"](items, "song_title", "asc");
    expect(itemsSorted).toStrictEqual([items[2], items[1], items[0]]);

    itemsSorted = repository["applySort"](items, "song_title", "desc");
    expect(itemsSorted).toStrictEqual([items[0], items[1], items[2]]);
  });

  it("should sort by created_at", async () => {
    const date1 = new Date("2023-01-01");
    const date2 = new Date("2023-01-02");
    const date3 = new Date("2023-01-03");

    const items = [
      Request.fake()
        .aRequest()
        .withCreatedAt(date2)
        .withSongTitle("Song")
        .withArtist("Artist")
        .withMessage("Fixed message")
        .build(),
      Request.fake()
        .aRequest()
        .withCreatedAt(date1)
        .withSongTitle("Song")
        .withArtist("Artist")
        .withMessage("Fixed message")
        .build(),
      Request.fake()
        .aRequest()
        .withCreatedAt(date3)
        .withSongTitle("Song")
        .withArtist("Artist")
        .withMessage("Fixed message")
        .build(),
    ];

    let itemsSorted = repository["applySort"](items, "created_at", "asc");
    expect(itemsSorted.map((item) => item.created_at)).toEqual([
      date1,
      date2,
      date3,
    ]);

    itemsSorted = repository["applySort"](items, "created_at", "desc");
    expect(itemsSorted.map((item) => item.created_at)).toEqual([
      date3,
      date2,
      date1,
    ]);
  });

  it("should sort by song_title", async () => {
    const items = [
      Request.fake()
        .aRequest()
        .withSongTitle("C Song")
        .withArtist("Artist C")
        .withMessage("Fixed message")
        .withCreatedAt(new Date("2023-01-01"))
        .build(),
      Request.fake()
        .aRequest()
        .withSongTitle("A Song")
        .withArtist("Artist A")
        .withMessage("Fixed message")
        .withCreatedAt(new Date("2023-01-01"))
        .build(),
      Request.fake()
        .aRequest()
        .withSongTitle("B Song")
        .withArtist("Artist B")
        .withMessage("Fixed message")
        .withCreatedAt(new Date("2023-01-01"))
        .build(),
    ];

    let itemsSorted = repository["applySort"](items, "song_title", "asc");
    expect(itemsSorted.map((item) => item.song_title.value)).toEqual([
      "A Song",
      "B Song",
      "C Song",
    ]);

    itemsSorted = repository["applySort"](items, "song_title", "desc");
    expect(itemsSorted.map((item) => item.song_title.value)).toEqual([
      "C Song",
      "B Song",
      "A Song",
    ]);
  });
});
