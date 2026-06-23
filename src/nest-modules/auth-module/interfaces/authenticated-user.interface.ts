export interface AuthenticatedUser {
  userId: string;
  roles: string[];
  establishmentIds: string[];
  bandIds: string[];
  organizationId?: string;
  isAdmin: boolean;
}
