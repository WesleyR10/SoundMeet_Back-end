import { SetMetadata } from "@nestjs/common";

export const INTERNAL_TOKEN_KEY = "internalToken";

export type InternalTokenMetadata = {
  envKey: string;
  headerName: string;
};

export const InternalToken = (metadata: InternalTokenMetadata) =>
  SetMetadata(INTERNAL_TOKEN_KEY, metadata);
