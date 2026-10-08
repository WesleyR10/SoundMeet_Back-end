import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from "class-validator";

import { BAND_IDENTITIES_MAX } from "../../../core/musician/application/use-cases/list-band-identities/list-band-identities.use-case";

/**
 * `?ids=a,b,c` — lista separada por vírgula, pelos mesmos dois motivos de
 * `ListMusicianIdentitiesDto`: o `qs` deixa de devolver LISTA acima de 20
 * itens, e a URL com vírgulas é a mesma para a mesma lista de ids, o que dá
 * ao cache do cliente uma chave estável.
 */
export class ListBandIdentitiesDto {
  @ApiProperty({
    description: `Ids das bandas, separados por vírgula (máx. ${BAND_IDENTITIES_MAX}).`,
    example:
      "4f17dae8-b502-4db8-8155-45f6b1712d16,f12c2a69-4c3b-4443-af8a-d3464fdb99ff",
    type: String,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string"
      ? value
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BAND_IDENTITIES_MAX)
  @IsUUID("all", { each: true })
  ids: string[];
}
