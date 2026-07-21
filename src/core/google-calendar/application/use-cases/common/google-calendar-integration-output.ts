import { GoogleCalendarIntegration } from "../../../domain/google-calendar-integration.aggregate";

export type GoogleCalendarStatusOutput = {
  connected: boolean;
  google_account_email: string | null;
};

export class GoogleCalendarStatusOutputMapper {
  static toOutput(
    integration: GoogleCalendarIntegration | null,
  ): GoogleCalendarStatusOutput {
    if (!integration || !integration.isConnected) {
      return { connected: false, google_account_email: null };
    }
    return {
      connected: true,
      google_account_email: integration.google_account_email,
    };
  }
}
