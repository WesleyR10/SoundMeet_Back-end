import { RegisterRole } from "./register.input";

export type RegisterOutput = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  role: RegisterRole;
  profile_id: string;
};
