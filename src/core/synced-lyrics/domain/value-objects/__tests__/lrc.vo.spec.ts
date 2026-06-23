import { LrcParser } from "../lrc.vo";

describe("LrcParser", () => {
  it("should parse a minimal LRC", () => {
    const raw = "[ar:Artist]\n[ti:Title]\n[00:01.00]Hello\n[00:02.50]World\n";
    const result = LrcParser.parse({ raw, provider: "ugc" });
    expect(result.isOk()).toBe(true);

    const parsed = result.ok;
    expect(parsed.provider).toBe("ugc");
    expect(parsed.hash.startsWith("sha256:")).toBe(true);
    expect(parsed.normalized.format).toBe("lrc");
    expect(parsed.normalized.meta.tags.ar).toBe("Artist");
    expect(parsed.normalized.meta.tags.ti).toBe("Title");
    expect(parsed.normalized.lines).toEqual([
      { start_ms: 1000, end_ms: 2500, text: "Hello" },
      { start_ms: 2500, end_ms: null, text: "World" },
    ]);
  });

  it("should parse multiple timestamps in a single line", () => {
    const raw = "[00:01.00][00:03.00]Chorus\n";
    const result = LrcParser.parse({ raw, provider: "lrclib" });
    expect(result.isOk()).toBe(true);

    expect(result.ok.normalized.lines).toEqual([
      { start_ms: 1000, end_ms: 3000, text: "Chorus" },
      { start_ms: 3000, end_ms: null, text: "Chorus" },
    ]);
  });

  it("should apply offset tag", () => {
    const raw = "[offset:500]\n[00:00.00]A\n[00:01.00]B\n";
    const result = LrcParser.parse({ raw, provider: "ugc" });
    expect(result.isOk()).toBe(true);

    expect(result.ok.normalized.meta.offset_ms).toBe(500);
    expect(result.ok.normalized.lines).toEqual([
      { start_ms: 500, end_ms: 1500, text: "A" },
      { start_ms: 1500, end_ms: null, text: "B" },
    ]);
  });

  it("should clamp negative timestamps after offset", () => {
    const raw = "[offset:-500]\n[00:00.00]A\n[00:01.00]B\n";
    const result = LrcParser.parse({ raw, provider: "ugc" });
    expect(result.isOk()).toBe(true);

    expect(result.ok.normalized.lines[0].start_ms).toBe(0);
    expect(result.ok.quality.flags).toContain("negative_timestamp");
  });

  it("should flag out-of-order timestamps", () => {
    const raw = "[00:05.00]B\n[00:01.00]A\n";
    const result = LrcParser.parse({ raw, provider: "ugc" });
    expect(result.isOk()).toBe(true);
    expect(result.ok.quality.flags).toContain("out_of_order");
    expect(result.ok.normalized.lines[0].text).toBe("A");
  });

  it("should fail when provider is missing", () => {
    const result = LrcParser.parse({ raw: "[00:01.00]A", provider: "" });
    expect(result.isFail()).toBe(true);
    expect(result.error).toBeInstanceOf(Error);
  });

  it("should fail when there are no timed lines", () => {
    const raw = "[ar:Artist]\n[ti:Title]\nplain text\n";
    const result = LrcParser.parse({ raw, provider: "ugc" });
    expect(result.isFail()).toBe(true);
  });
});
