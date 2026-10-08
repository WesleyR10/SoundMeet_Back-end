import { numeroComExtenso } from "../../contract-format";
import { ClauseDefinition } from "../clause.types";
import { plural } from "../clause-helpers";

/**
 * Cancelamento, remarcação e as hipóteses em que ninguém responde.
 *
 * A política de cancelamento **não** é escolhida por variante de texto: ela já é
 * dado do `Booking` (`free_cancellation_hours`) e do contexto
 * (`cancelamento_multa_percentual`). Um texto parametrizado é mais honesto que
 * três textos alternativos — o que muda entre um contrato flexível e um
 * rigoroso são os números, e é isso que a parte precisa enxergar.
 */

export const CANCELAMENTO_REMARCACAO_CLAUSE: ClauseDefinition = {
  key: "cancelamento_remarcacao",
  category: "cancelamento",
  required: true,
  legal_note:
    "🔴 Cláusula penal — CC art. 412: não pode exceder o valor da obrigação " +
    "principal, e o art. 413 permite ao juiz reduzi-la quando manifestamente " +
    "excessiva. O teto de 100% é validado em `ContractVariables`, não apenas " +
    "escrito aqui: multa acima disso é cláusula nula, e cláusula nula é pior " +
    "que cláusula ausente porque dá ao usuário uma confiança que o documento " +
    "não sustenta. A janela vem de `Booking.free_cancellation_hours`, nunca de " +
    "constante do catálogo.",
  variants: [
    {
      variant_id: "cancelamento_remarcacao.padrao.formal",
      tone: "formal",
      applicability: {},
      consumes: [
        "cancelamento_janela_horas",
        "cancelamento_multa_percentual",
        "cancelamento_multa_formatada",
      ],
      title: "Do cancelamento e da remarcação",
      body: (v) => `
        Qualquer das partes poderá cancelar a apresentação mediante comunicação
        escrita à outra, observadas as seguintes condições:

        (a) cancelamento comunicado com antecedência igual ou superior a
        ${numeroComExtenso(v.cancelamento_janela_horas, "feminino")}
        ${plural(v.cancelamento_janela_horas, "hora", "horas")} do horário de
        início não gera penalidade a nenhuma das partes;

        (b) cancelamento comunicado com antecedência inferior a
        ${numeroComExtenso(v.cancelamento_janela_horas, "feminino")}
        ${plural(v.cancelamento_janela_horas, "hora", "horas")} sujeita a parte
        que cancelou ao pagamento, à outra, de multa compensatória equivalente a
        ${v.cancelamento_multa_percentual}% do valor contratado, isto é,
        ${v.cancelamento_multa_formatada}.

        Parágrafo primeiro. A remarcação consensual para nova data, formalizada
        por escrito antes do horário de início, afasta a multa prevista na
        alínea (b).

        Parágrafo segundo. A multa prevista neste instrumento tem natureza
        compensatória e está limitada ao valor da obrigação principal, nos
        termos do art. 412 do Código Civil.

        Parágrafo terceiro. Não incide multa nas hipóteses de caso fortuito ou
        força maior tratadas neste instrumento.
      `,
    },
    {
      variant_id: "cancelamento_remarcacao.padrao.direto",
      tone: "direto",
      applicability: {},
      consumes: [
        "cancelamento_janela_horas",
        "cancelamento_multa_percentual",
        "cancelamento_multa_formatada",
      ],
      title: "Do cancelamento e da remarcação",
      body: (v) => `
        Qualquer das partes pode cancelar, avisando a outra por escrito.

        Cancelou com ${numeroComExtenso(v.cancelamento_janela_horas, "feminino")}
        ${plural(v.cancelamento_janela_horas, "hora", "horas")} ou mais de
        antecedência: sem multa.

        Cancelou com menos que isso: paga à outra parte
        ${v.cancelamento_multa_percentual}% do valor contratado, ou seja,
        ${v.cancelamento_multa_formatada}.

        Remarcar de comum acordo, por escrito e antes do horário de início,
        cancela a multa. Caso fortuito e força maior também.

        A multa é compensatória e nunca passa do valor do contrato (CC art. 412).
      `,
    },
    {
      variant_id: "cancelamento_remarcacao.rigorosa.rigoroso",
      tone: "rigoroso",
      applicability: {},
      consumes: [
        "cancelamento_janela_horas",
        "cancelamento_multa_percentual",
        "cancelamento_multa_formatada",
      ],
      title: "Do cancelamento, da remarcação e do não comparecimento",
      body: (v) => `
        Qualquer das partes poderá cancelar a apresentação mediante comunicação
        escrita à outra, observadas as seguintes condições:

        (a) cancelamento comunicado com antecedência igual ou superior a
        ${numeroComExtenso(v.cancelamento_janela_horas, "feminino")}
        ${plural(v.cancelamento_janela_horas, "hora", "horas")} do horário de
        início não gera penalidade;

        (b) cancelamento comunicado com antecedência inferior sujeita a parte
        que cancelou ao pagamento, à outra, de multa compensatória de
        ${v.cancelamento_multa_percentual}% do valor contratado, isto é,
        ${v.cancelamento_multa_formatada};

        (c) o não comparecimento sem comunicação prévia equipara-se ao
        cancelamento previsto na alínea (b), acrescido da obrigação de
        ressarcimento das despesas comprovadamente incorridas pela parte
        prejudicada em razão da apresentação frustrada.

        Parágrafo primeiro. A remarcação consensual para nova data, formalizada
        por escrito antes do horário de início, afasta as penalidades acima.

        Parágrafo segundo. A soma da multa com o ressarcimento previsto na
        alínea (c) está limitada ao valor da obrigação principal, nos termos do
        art. 412 do Código Civil.

        Parágrafo terceiro. Não incidem penalidades nas hipóteses de caso
        fortuito ou força maior tratadas neste instrumento.
      `,
    },
  ],
};

export const CASO_FORTUITO_CLAUSE: ClauseDefinition = {
  key: "caso_fortuito",
  category: "cancelamento",
  required: true,
  legal_note:
    "CC art. 393: o devedor não responde por caso fortuito ou força maior, " +
    "salvo se expressamente se responsabilizou. A cláusula existe para " +
    "ENUMERAR as hipóteses do mundo real do show — interdição, blecaute, " +
    "determinação de autoridade, luto oficial — e evitar a discussão sobre o " +
    "que conta. A variante ao ar livre trata chuva, que sem menção expressa " +
    "vira litígio garantido.",
  variants: [
    {
      variant_id: "caso_fortuito.padrao.formal",
      tone: "formal",
      applicability: { outdoor: false },
      consumes: [],
      title: "Do caso fortuito e da força maior",
      body: () => `
        Nenhuma das partes responderá por descumprimento decorrente de caso
        fortuito ou força maior, nos termos do art. 393 do Código Civil,
        compreendidas, entre outras hipóteses, a interdição do local por
        autoridade competente, a interrupção do fornecimento de energia elétrica
        não imputável ao CONTRATANTE, a determinação de autoridade pública que
        impeça a realização do evento, a decretação de luto oficial e a
        impossibilidade de comparecimento por motivo de saúde grave devidamente
        comprovado.

        Parágrafo primeiro. A parte impossibilitada comunicará a outra tão logo
        tome conhecimento do fato, com a respectiva comprovação.

        Parágrafo segundo. Verificada a hipótese, as partes buscarão de boa-fé a
        remarcação da apresentação; não sendo possível, o contrato será resolvido
        sem ônus para qualquer delas, restituindo-se eventuais valores já pagos.
      `,
    },
    {
      variant_id: "caso_fortuito.ao_ar_livre.formal",
      tone: "formal",
      applicability: { outdoor: true },
      consumes: [],
      title: "Do caso fortuito, da força maior e das condições climáticas",
      body: () => `
        Nenhuma das partes responderá por descumprimento decorrente de caso
        fortuito ou força maior, nos termos do art. 393 do Código Civil,
        compreendidas, entre outras hipóteses, a interdição do local por
        autoridade competente, a interrupção do fornecimento de energia elétrica
        não imputável ao CONTRATANTE, a determinação de autoridade pública que
        impeça a realização do evento, a decretação de luto oficial e a
        impossibilidade de comparecimento por motivo de saúde grave devidamente
        comprovado.

        Parágrafo primeiro. Tratando-se de apresentação em área descoberta,
        condições climáticas que ofereçam risco à integridade física dos
        presentes ou aos equipamentos — notadamente chuva, descargas
        atmosféricas ou ventos fortes — autorizam a suspensão ou o cancelamento
        da apresentação sem penalidade a qualquer das partes.

        Parágrafo segundo. A decisão de suspender por motivo climático caberá
        conjuntamente às partes; havendo divergência, prevalecerá a recusa
        fundada em risco à segurança.

        Parágrafo terceiro. Verificada a hipótese, as partes buscarão de boa-fé a
        remarcação da apresentação; não sendo possível, o contrato será resolvido
        sem ônus para qualquer delas, restituindo-se eventuais valores já pagos.
      `,
    },
  ],
};
