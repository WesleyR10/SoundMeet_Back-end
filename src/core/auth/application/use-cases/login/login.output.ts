import { RegisterRole } from "../register/register.input";

export type LoginOutput = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  role: RegisterRole;
  profile_id: string;
};
