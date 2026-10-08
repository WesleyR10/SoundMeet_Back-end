import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from "class-validator";

import { MUSICIAN_IDENTITIES_MAX } from "../../../core/musician/application/use-cases/list-musician-identities/list-musician-identities.use-case";

/**
 * `?ids=a,b,c` — lista separada por vírgula.
 *
 * Vírgula, e não `ids[]=a&ids[]=b`, por dois motivos concretos: o `qs` deixa
 * de devolver LISTA acima de 20 itens (vira objeto), e uma página de lista do
 * painel passa disso; e a URL com vírgulas é a mesma para a mesma lista de
 * ids, o que dá ao cache do cliente uma chave estável. A forma com colchetes
 * também é aceita, até o teto do `qs`.
 */
export class ListMusicianIdentitiesDto {
  @ApiProperty({
    description: `Ids dos músicos, separados por vírgula (máx. ${MUSICIAN_IDENTITIES_MAX}).`,
    example:
      "9366b7dc-2d71-4799-b91c-c64adb205104,49fd851f-be83-4bc7-9776-2f2d037499ef",
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
  @ArrayMaxSize(MUSICIAN_IDENTITIES_MAX)
  @IsUUID("all", { each: true })
  ids: string[];
}
