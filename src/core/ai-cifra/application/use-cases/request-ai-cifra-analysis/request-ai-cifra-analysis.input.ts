import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export type RequestAiCifraAnalysisInput = {
  ai_cifra_upload_id: string;
  model_id?: string;
  requesting_musician_id?: string;
  is_admin?: boolean;
};

export class RequestAiCifraAnalysisInputValidator {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  ai_cifra_upload_id: string;

  @IsString()
  @IsOptional()
  model_id?: string;

  constructor(props: RequestAiCifraAnalysisInput) {
    Object.assign(this, props);
  }
}
