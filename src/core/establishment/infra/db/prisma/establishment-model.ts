export type EstablishmentModel = {
  id: string;
  email: string;
  name: string;
  description: string | null;
  avatar: string | null;
  cnpj: string | null;
  phone: string | null;
  is_active: boolean;
  isVerified: boolean;
  created_at: Date;
  updated_at: Date;

  // Endereço (Flattened)
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip_code?: string | null;
  address_lat?: number | null;
  address_long?: number | null;
};
