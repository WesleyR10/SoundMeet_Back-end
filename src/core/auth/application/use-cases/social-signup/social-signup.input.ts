export type SocialSignupRole = "musician" | "audience";

export type SocialSignupInput = {
  user_id: string;
  existing_roles: string[];
  role: SocialSignupRole;
  cpf?: string;
  phone?: string;
};
