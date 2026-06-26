import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export type GetAiCifraAnalysisJobInput = {
  id: string;
  requesting_musician_id?: string;
  is_admin?: boolean;
};

export class GetAiCifraAnalysisJobInputValidator {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  id: string;

  constructor(props: GetAiCifraAnalysisJobInput) {
    Object.assign(this, props);
  }
}
