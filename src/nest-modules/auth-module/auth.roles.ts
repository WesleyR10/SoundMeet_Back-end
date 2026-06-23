export type AuthRole = "audience" | "musician" | "establishment" | "admin";

export type AuthUser = {
  sub?: string;
  email?: string;
  preferred_username?: string;
  roles: string[];
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
};
