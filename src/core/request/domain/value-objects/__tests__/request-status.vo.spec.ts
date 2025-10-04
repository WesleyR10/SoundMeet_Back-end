import { RequestStatus, RequestStatusEnum } from "../request-status.vo";

describe("RequestStatus Unit Tests", () => {
  describe("constructor", () => {
    test("should create with valid status", () => {
      const status = new RequestStatus(RequestStatusEnum.PENDING);
      expect(status.value).toBe(RequestStatusEnum.PENDING);
    });

    test("should throw error with invalid status", () => {
      expect(() => new RequestStatus("invalid" as RequestStatusEnum)).toThrow(
        "Invalid request status: invalid",
      );
    });

    test("should throw error with null status", () => {
      expect(() => new RequestStatus(null as any)).toThrow(
        "Request status is required",
      );
    });

    test("should throw error with undefined status", () => {
      expect(() => new RequestStatus(undefined as any)).toThrow(
        "Request status is required",
      );
    });
  });

  describe("static factory methods", () => {
    test("should create pending status", () => {
      const status = RequestStatus.pending();
      expect(status.value).toBe(RequestStatusEnum.PENDING);
      expect(status.isPending()).toBe(true);
    });

    test("should create accepted status", () => {
      const status = RequestStatus.accepted();
      expect(status.value).toBe(RequestStatusEnum.ACCEPTED);
      expect(status.isAccepted()).toBe(true);
    });

    test("should create rejected status", () => {
      const status = RequestStatus.rejected();
      expect(status.value).toBe(RequestStatusEnum.REJECTED);
      expect(status.isRejected()).toBe(true);
    });
  });

  describe("status check methods", () => {
    test("should correctly identify pending status", () => {
      const status = RequestStatus.pending();
      expect(status.isPending()).toBe(true);
      expect(status.isAccepted()).toBe(false);
      expect(status.isRejected()).toBe(false);
    });

    test("should correctly identify accepted status", () => {
      const status = RequestStatus.accepted();
      expect(status.isPending()).toBe(false);
      expect(status.isAccepted()).toBe(true);
      expect(status.isRejected()).toBe(false);
    });

    test("should correctly identify rejected status", () => {
      const status = RequestStatus.rejected();
      expect(status.isPending()).toBe(false);
      expect(status.isAccepted()).toBe(false);
      expect(status.isRejected()).toBe(true);
    });
  });

  describe("toString", () => {
    test("should return string representation", () => {
      expect(RequestStatus.pending().toString()).toBe("pending");
      expect(RequestStatus.accepted().toString()).toBe("accepted");
      expect(RequestStatus.rejected().toString()).toBe("rejected");
    });
  });

  describe("equals", () => {
    test("should return true for same status values", () => {
      const status1 = RequestStatus.pending();
      const status2 = RequestStatus.pending();
      expect(status1.equals(status2)).toBe(true);
    });

    test("should return false for different status values", () => {
      const status1 = RequestStatus.pending();
      const status2 = RequestStatus.accepted();
      expect(status1.equals(status2)).toBe(false);
    });

    test("should return false when comparing with null", () => {
      const status = RequestStatus.pending();
      expect(status.equals(null as any)).toBe(false);
    });

    test("should return false when comparing with different type", () => {
      const status = RequestStatus.pending();
      expect(status.equals("pending" as any)).toBe(false);
    });
  });

  describe("validation", () => {
    test("should validate all enum values", () => {
      expect(() => new RequestStatus(RequestStatusEnum.PENDING)).not.toThrow();
      expect(() => new RequestStatus(RequestStatusEnum.ACCEPTED)).not.toThrow();
      expect(() => new RequestStatus(RequestStatusEnum.REJECTED)).not.toThrow();
    });

    test("should reject invalid enum values", () => {
      const invalidValues = ["INVALID", "ACCEPTED_INVALID", "pending_invalid"];

      invalidValues.forEach((value) => {
        expect(() => new RequestStatus(value as RequestStatusEnum)).toThrow(
          `Invalid request status: ${value}`,
        );
      });
    });
  });
});
