export type EstablishmentModel = {
  id: string;
  email: string;
  name: string;
  description: string | null;
  avatar: string | null;
  cnpj: string | null;
  phone: string | null;
  isActive: boolean;
  isVerified: boolean;
  created_at: Date;
  updated_at: Date;
};
