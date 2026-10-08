import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";

import {
  inspectSocialLink,
  SocialUrlPlatform,
} from "../../domain/value-objects/external-url.vo";

/**
 * Valida o campo de uma rede social com a MESMA regra que o cliente usa para
 * abrir o link (`buildSocialUrl`) — ver `inspectSocialLink`.
 *
 * Aceita handle (`@joao`), host da própria rede (`instagram.com/joao`) e URL
 * https completa. Recusa `http:` (downgrade), `javascript:`/`data:`/`file:`,
 * userinfo (`https://instagram.com@evil.example/`), homógrafo, `%` no host e
 * qualquer host fora do domínio da rede.
 *
 * ⚠️ Não é `@IsUrl()` do class-validator: aquele aceita `http://`, aceita
 * userinfo e não sabe de qual rede é o campo.
 */
export function IsSocialLink(
  platform: SocialUrlPlatform,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isSocialLink",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [platform],
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          // Campo opcional vazio é ausência, não valor inválido — o app manda
          // string vazia quando o músico limpa o campo.
          if (value === undefined || value === null || value === "") {
            return true;
          }
          if (typeof value !== "string") return false;

          return inspectSocialLink(
            args.constraints[0] as SocialUrlPlatform,
            value,
          ).ok;
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be a ${String(
            args.constraints[0],
          )} handle or an https link to ${String(args.constraints[0])}`;
        },
      },
    });
  };
}
