import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";

/**
 * Ano de formação de uma banda.
 *
 * O piso é 1900 e o teto é o ANO CORRENTE. A banda pode ter se formado ontem,
 * nunca no ano que vem — "tocamos juntos desde 2031" não é uma imprecisão, é
 * uma credencial falsa numa tela em que o estabelecimento decide contratar.
 */
export const FORMATION_YEAR_MIN = 1900;

/**
 * 🔴 O teto é calculado A CADA CHAMADA, e isso é o ponto desta função existir.
 *
 * Com `@Max(new Date().getFullYear())` o decorator congelaria o ano no momento
 * em que o módulo é carregado — um processo de pé desde dezembro passaria a
 * recusar o ano corrente na virada, e o erro só apareceria em produção, uma vez
 * por ano, para quem tivesse a infelicidade de cadastrar a banda em 1º de
 * janeiro. Nenhum teste pegaria isso.
 */
export function isFormationYear(value: unknown): boolean {
  if (typeof value !== "number" || !Number.isInteger(value)) return false;
  // `getFullYear()` é hora LOCAL, e aqui isso é a escolha certa: o ano que o
  // músico tem em mente é o do relógio dele, não o do UTC. Na virada, um
  // servidor em UTC aceita o ano seguinte por algumas horas antes do Brasil
  // chegar nele — erra para o lado de ACEITAR, que é o certo num campo
  // autodeclarado: recusar um ano legítimo é pior que aceitar um cedo demais.
  return value >= FORMATION_YEAR_MIN && value <= new Date().getFullYear();
}

/**
 * Decorator do ano de formação (`bands.formed_in`).
 *
 * Trata `null`/`undefined` como ausência válida: não declarar o ano é o estado
 * normal, e quem digitou errado precisa de caminho de volta para ele.
 */
export function IsFormationYear(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isFormationYear",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (value === undefined || value === null) return true;
          return isFormationYear(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be an integer year between ${FORMATION_YEAR_MIN} and the current year`;
        },
      },
    });
  };
}
