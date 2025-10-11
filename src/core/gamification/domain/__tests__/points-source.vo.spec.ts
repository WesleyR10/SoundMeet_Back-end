import {
  PointsSource,
  PointsSourceEnum,
} from "../value-objects/points-source.vo";

describe("PointsSource Unit Tests", () => {
  test("should create PointsSource with SCAN_QR", () => {
    const pointsSource = PointsSource.scanQr();
    expect(pointsSource.value).toBe(PointsSourceEnum.SCAN_QR);
    expect(pointsSource.getPointsValue()).toBe(10);
    expect(pointsSource.isScanQr()).toBe(true);
    expect(pointsSource.isRequest()).toBe(false);
    expect(pointsSource.isTip()).toBe(false);
    expect(pointsSource.isSocialShare()).toBe(false);
    expect(pointsSource.isAcceptedRequest()).toBe(false);
  });

  test("should create PointsSource with REQUEST", () => {
    const pointsSource = PointsSource.request();
    expect(pointsSource.value).toBe(PointsSourceEnum.REQUEST);
    expect(pointsSource.getPointsValue()).toBe(25);
    expect(pointsSource.isScanQr()).toBe(false);
    expect(pointsSource.isRequest()).toBe(true);
    expect(pointsSource.isTip()).toBe(false);
    expect(pointsSource.isSocialShare()).toBe(false);
    expect(pointsSource.isAcceptedRequest()).toBe(false);
  });

  test("should create PointsSource with TIP", () => {
    const pointsSource = PointsSource.tip();
    expect(pointsSource.value).toBe(PointsSourceEnum.TIP);
    expect(pointsSource.getPointsValue()).toBe(1);
    expect(pointsSource.isScanQr()).toBe(false);
    expect(pointsSource.isRequest()).toBe(false);
    expect(pointsSource.isTip()).toBe(true);
    expect(pointsSource.isSocialShare()).toBe(false);
    expect(pointsSource.isAcceptedRequest()).toBe(false);
  });

  test("should create PointsSource with SOCIAL_SHARE", () => {
    const pointsSource = PointsSource.socialShare();
    expect(pointsSource.value).toBe(PointsSourceEnum.SOCIAL_SHARE);
    expect(pointsSource.getPointsValue()).toBe(50);
    expect(pointsSource.isScanQr()).toBe(false);
    expect(pointsSource.isRequest()).toBe(false);
    expect(pointsSource.isTip()).toBe(false);
    expect(pointsSource.isSocialShare()).toBe(true);
    expect(pointsSource.isAcceptedRequest()).toBe(false);
  });

  test("should create PointsSource with ACCEPTED_REQUEST", () => {
    const pointsSource = PointsSource.acceptedRequest();
    expect(pointsSource.value).toBe(PointsSourceEnum.ACCEPTED_REQUEST);
    expect(pointsSource.getPointsValue()).toBe(50);
    expect(pointsSource.isScanQr()).toBe(false);
    expect(pointsSource.isRequest()).toBe(false);
    expect(pointsSource.isTip()).toBe(false);
    expect(pointsSource.isSocialShare()).toBe(false);
    expect(pointsSource.isAcceptedRequest()).toBe(true);
  });

  test("should create PointsSource with create method", () => {
    const pointsSource = PointsSource.create(PointsSourceEnum.SCAN_QR);
    expect(pointsSource.value).toBe(PointsSourceEnum.SCAN_QR);
    expect(pointsSource.getPointsValue()).toBe(10);
  });

  test("should throw error for invalid source", () => {
    expect(() => {
      PointsSource.create("INVALID_SOURCE" as PointsSourceEnum);
    }).toThrow("Invalid points source: INVALID_SOURCE");
  });

  test("should validate all enum values", () => {
    const enumValues = Object.values(PointsSourceEnum);
    expect(enumValues).toContain(PointsSourceEnum.SCAN_QR);
    expect(enumValues).toContain(PointsSourceEnum.REQUEST);
    expect(enumValues).toContain(PointsSourceEnum.TIP);
    expect(enumValues).toContain(PointsSourceEnum.SOCIAL_SHARE);
    expect(enumValues).toContain(PointsSourceEnum.ACCEPTED_REQUEST);
  });

  test("should have correct points values for all sources", () => {
    expect(PointsSource.scanQr().getPointsValue()).toBe(10);
    expect(PointsSource.request().getPointsValue()).toBe(25);
    expect(PointsSource.tip().getPointsValue()).toBe(1);
    expect(PointsSource.socialShare().getPointsValue()).toBe(50);
    expect(PointsSource.acceptedRequest().getPointsValue()).toBe(50);
  });
});
