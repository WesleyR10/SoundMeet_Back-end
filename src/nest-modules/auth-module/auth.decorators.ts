import { SetMetadata } from "@nestjs/common";

import { AuthRole } from "./auth.roles";

export const IS_PUBLIC_KEY = "isPublic";
export const ROLES_KEY = "roles";

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const Roles = (...roles: AuthRole[]) => SetMetadata(ROLES_KEY, roles);
