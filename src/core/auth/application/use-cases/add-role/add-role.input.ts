export type AddRoleRole = "musician" | "audience";

export type AddRoleInput = {
  user_id: string;
  existing_roles: string[];
  role: AddRoleRole;
  cpf?: string;
  phone?: string;
};
