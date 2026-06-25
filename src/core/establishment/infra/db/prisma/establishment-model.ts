export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue | undefined };
export type JsonArray = JsonValue[];

export type EstablishmentProfileModel = {
  id: string;
  establishmentId: string;
  capacity: number | null;
  location: JsonValue;
  location_city: string;
  location_lat: number | null;
  location_lng: number | null;
  amenities: string[];
  preferredGenres: string[];
  operatingHours: JsonValue | null;
  priceRange: JsonValue | null;
  socialLinks: JsonValue | null;
  created_at: Date;
  updated_at: Date;
};

export type EstablishmentModel = {
  id: string;
  email: string;
  name: string;
  description: string | null;
  avatar: string | null;
  cnpj: string | null;
  phone: string | null;
  website: string | null;
  establishment_type: string;
  qr_code: string | null;
  rating: number;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  email_verified_at?: Date | null;
  email_pending?: string | null;
  email_token?: string | null;
  email_token_expires_at?: Date | null;
  created_at: Date;
  updated_at: Date;
  profile?: EstablishmentProfileModel | null;
};
