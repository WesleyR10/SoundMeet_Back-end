import { RequestEventProcessingService } from "../request-event-processing.service";

describe("RequestEventProcessingService", () => {
  const cache = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("skips work when idempotency key was already processed", async () => {
    cache.get.mockResolvedValue(true);
    const service = new RequestEventProcessingService(cache as any);
    const work = jest.fn();

    await expect(service.processOnce("created:1", work)).resolves.toBeNull();

    expect(work).not.toHaveBeenCalled();
    expect(cache.get).toHaveBeenCalledWith("request_event:created:1");
  });

  it("retries transient failures and marks successful work as processed", async () => {
    cache.get.mockResolvedValue(undefined);
    cache.set.mockResolvedValue(undefined);
    const service = new RequestEventProcessingService(cache as any);
    const work = jest
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce("ok");

    await expect(service.processOnce("accepted:1", work)).resolves.toBe("ok");

    expect(work).toHaveBeenCalledTimes(2);
    expect(cache.set).toHaveBeenCalledWith(
      "request_event:accepted:1",
      true,
      60 * 60 * 24,
    );
  });
});
