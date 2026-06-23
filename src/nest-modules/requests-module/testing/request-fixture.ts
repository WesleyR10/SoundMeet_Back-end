const _keysInResponse = [
  "id",
  "event_id",
  "audience_id",
  "musician_id",
  "library_id",
  "song_title",
  "artist",
  "message",
  "status",
  "rejection_reason",
  "votes_count",
  "created_at",
  "played_at",
  "updated_at",
  "responded_at",
  "is_pending",
  "is_accepted",
  "is_played",
  "is_rejected",
  "is_responded",
  "has_message",
  "display_title",
  "age_in_minutes",
  "is_recent",
  "is_old",
  "is_urgent",
  "priority",
  "points_value",
  "is_special_request",
  "can_be_accepted",
  "can_be_rejected",
  "is_within_response_time",
];

export class CreateRequestFixture {
  static keysInResponse = _keysInResponse;

  static arrangeForCreate() {
    return [
      {
        send_data: {
          song_title: "Song Title",
          artist: "Artist",
          message: "Message",
        },
        expected: {
          song_title: "Song Title",
          artist: "Artist",
          message: "Message",
          status: "pending",
        },
      },
      {
        send_data: {
          song_title: "Song Title",
        },
        expected: {
          song_title: "Song Title",
          artist: null,
          message: null,
          status: "pending",
        },
      },
    ];
  }
}
