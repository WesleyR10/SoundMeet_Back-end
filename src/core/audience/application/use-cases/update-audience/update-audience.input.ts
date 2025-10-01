export type UpdateAudienceInput = {
  id: string;
  name?: string;
  nickname?: string | null;
  avatar?: string | null;
  phone?: string | null;
  favorite_genres?: string[];
  favorite_instruments?: string[];
  is_active?: boolean;
};
