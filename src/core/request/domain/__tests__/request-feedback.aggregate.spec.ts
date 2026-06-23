import {
  InvalidUuidError,
  Uuid,
} from "../../../shared/domain/value-objects/uuid.vo";
import {
  RequestFeedback,
  RequestFeedbackId,
} from "../request-feedback.aggregate";

describe("RequestFeedback Unit Tests", () => {
  test("should create a feedback with valid data", () => {
    const request_id = new Uuid().id;

    const feedback = RequestFeedback.create({
      request_id,
      rating: 5,
      comment: "Great performance!",
    });

    expect(feedback.request_feedback_id).toBeInstanceOf(RequestFeedbackId);
    expect(feedback.request_id).toBeInstanceOf(Uuid);
    expect(feedback.rating).toBe(5);
    expect(feedback.comment).toBe("Great performance!");
    expect(feedback.created_at).toBeInstanceOf(Date);
    expect(feedback.notification.hasErrors()).toBe(false);

    expect(feedback.toJSON()).toEqual(
      expect.objectContaining({
        request_feedback_id: feedback.request_feedback_id.id,
        request_id,
        rating: 5,
        comment: "Great performance!",
        has_comment: true,
        is_positive: true,
        is_neutral: false,
        is_negative: false,
      }),
    );
  });

  test("should create a feedback without comment", () => {
    const feedback = RequestFeedback.create({
      request_id: new Uuid().id,
      rating: 3,
    });

    expect(feedback.comment).toBeNull();
    expect(feedback.hasComment).toBe(false);
    expect(feedback.isNeutral).toBe(true);
    expect(feedback.notification.hasErrors()).toBe(false);
  });

  test.each([
    { rating: 1, isNegative: true, isNeutral: false, isPositive: false },
    { rating: 2, isNegative: true, isNeutral: false, isPositive: false },
    { rating: 3, isNegative: false, isNeutral: true, isPositive: false },
    { rating: 4, isNegative: false, isNeutral: false, isPositive: true },
    { rating: 5, isNegative: false, isNeutral: false, isPositive: true },
  ])(
    "should compute sentiment getters for rating $rating",
    ({ rating, isNegative, isNeutral, isPositive }) => {
      const feedback = RequestFeedback.create({
        request_id: new Uuid().id,
        rating,
      });

      expect(feedback.isNegative).toBe(isNegative);
      expect(feedback.isNeutral).toBe(isNeutral);
      expect(feedback.isPositive).toBe(isPositive);
    },
  );

  test.each([0, 6, -1, 10])(
    "should set notification error when rating %s is out of range",
    (rating) => {
      const feedback = RequestFeedback.create({
        request_id: new Uuid().id,
        rating,
      });

      expect(feedback.notification.hasErrors()).toBe(true);
      expect(feedback.notification).notificationContainsErrorMessages([
        {
          rating: [
            "rating must not be greater than 5",
            "rating must not be less than 1",
          ],
        },
      ]);
    },
  );

  test("should throw error when request_id is invalid uuid", () => {
    expect(() =>
      RequestFeedback.create({
        request_id: "invalid-uuid",
        rating: 5,
      }),
    ).toThrow(InvalidUuidError);
  });

  test("should change rating", () => {
    const feedback = RequestFeedback.create({
      request_id: new Uuid().id,
      rating: 5,
    });

    feedback.changeRating(2);

    expect(feedback.rating).toBe(2);
    expect(feedback.isNegative).toBe(true);
    expect(feedback.notification.hasErrors()).toBe(false);
  });

  test("should change comment", () => {
    const feedback = RequestFeedback.create({
      request_id: new Uuid().id,
      rating: 5,
      comment: "Initial",
    });

    feedback.changeComment("Updated comment");
    expect(feedback.comment).toBe("Updated comment");

    feedback.changeComment(null);
    expect(feedback.comment).toBeNull();
    expect(feedback.hasComment).toBe(false);
  });
});
