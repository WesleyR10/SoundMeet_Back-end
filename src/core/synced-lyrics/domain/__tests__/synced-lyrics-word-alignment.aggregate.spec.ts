import { SyncedLyrics } from "../synced-lyrics.aggregate";

describe("SyncedLyrics.applyWordAlignment Unit Tests", () => {
  it("should attach real word timestamps to the matching line and flip has_word_timestamps", () => {
    // fake builder default: "[00:00.00]Hello\n[00:01.00]World\n" — 2 linhas,
    // sem palavra-a-palavra (LRC comum nunca tem isso, ver LrcParser).
    const entity = SyncedLyrics.fake().aSyncedLyrics().build();
    expect(entity.lrc_has_word_timestamps).toBe(false);
    const versionBefore = entity.lrc_version;

    entity.applyWordAlignment(
      {
        lines: [
          {
            index: 0,
            words: [{ text: "Hello", start_ms: 0, end_ms: 400 }],
          },
        ],
      },
      new Date(),
    );

    expect(entity.notification.hasErrors()).toBe(false);
    expect(entity.lrc_has_word_timestamps).toBe(true);
    expect(entity.lrc_normalized?.meta.has_word_timestamps).toBe(true);
    expect(entity.lrc_normalized?.lines[0].words).toEqual([
      { text: "Hello", start_ms: 0, end_ms: 400 },
    ]);
    expect(entity.lrc_quality_flags).toContain("word_aligned");
    expect(entity.lrc_version).toBe(versionBefore + 1);
  });

  it("should leave lines not covered by the command untouched", () => {
    const entity = SyncedLyrics.fake().aSyncedLyrics().build();

    entity.applyWordAlignment(
      {
        lines: [
          { index: 0, words: [{ text: "Hello", start_ms: 0, end_ms: 400 }] },
        ],
      },
      new Date(),
    );

    expect(entity.lrc_normalized?.lines[1].words).toBeUndefined();
  });

  it("should add a validation error and not mutate state when lrc_normalized is empty", () => {
    const entity = SyncedLyrics.fake()
      .aSyncedLyrics()
      .withLrcRaw(() => null)
      .withLrcProvider(() => null)
      .build();
    expect(entity.lrc_normalized).toBeNull();
    const versionBefore = entity.lrc_version;

    entity.applyWordAlignment(
      {
        lines: [
          { index: 0, words: [{ text: "Hi", start_ms: 0, end_ms: 100 }] },
        ],
      },
      new Date(),
    );

    expect(entity.notification.hasErrors()).toBe(true);
    expect(entity.lrc_has_word_timestamps).toBe(false);
    expect(entity.lrc_version).toBe(versionBefore);
  });

  it("should be a silent no-op when the alignment produced no usable words", () => {
    const entity = SyncedLyrics.fake().aSyncedLyrics().build();
    const versionBefore = entity.lrc_version;

    entity.applyWordAlignment({ lines: [{ index: 0, words: [] }] }, new Date());

    expect(entity.notification.hasErrors()).toBe(false);
    expect(entity.lrc_has_word_timestamps).toBe(false);
    expect(entity.lrc_version).toBe(versionBefore);
  });

  it("should not duplicate the word_aligned flag when applied more than once", () => {
    const entity = SyncedLyrics.fake().aSyncedLyrics().build();

    entity.applyWordAlignment(
      {
        lines: [
          { index: 0, words: [{ text: "Hello", start_ms: 0, end_ms: 400 }] },
        ],
      },
      new Date(),
    );
    entity.applyWordAlignment(
      {
        lines: [
          {
            index: 1,
            words: [{ text: "World", start_ms: 1000, end_ms: 1400 }],
          },
        ],
      },
      new Date(),
    );

    const occurrences = entity.lrc_quality_flags.filter(
      (f) => f === "word_aligned",
    ).length;
    expect(occurrences).toBe(1);
    expect(entity.lrc_normalized?.lines[1].words).toEqual([
      { text: "World", start_ms: 1000, end_ms: 1400 },
    ]);
  });
});
