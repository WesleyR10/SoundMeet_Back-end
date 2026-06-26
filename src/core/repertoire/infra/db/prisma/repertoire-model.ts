export type RepertoireSongModel = {
  id: string;
  repertoire_id: string;
  music_library_id: string;
  position: number;
  custom_notes: string | null;
  duration_override_seconds: number | null;
  added_at: Date;
};

export type RepertoireInviteeModel = {
  id: string;
  repertoire_id: string;
  musician_id: string;
  invited_at: Date;
};

export type RepertoireModel = {
  id: string;
  musician_id: string;
  name: string;
  share_token: string | null;
  share_token_expires_at: Date | null;
  is_shared: boolean;
  created_at: Date;
  updated_at: Date;
  songs?: RepertoireSongModel[];
  invitees?: RepertoireInviteeModel[];
};
