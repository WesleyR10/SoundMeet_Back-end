import { ClauseDefinition } from "../clause.types";
import { req } from "../clause-helpers";

/**
 * Cachê, forma de pagamento e — quando há custódia — liberação do valor.
 *
 * 🔑 **É aqui que o escrow (F1.3a) encosta no contrato.** As variantes
 * `com_custodia` só são escolhidas quando o contexto traz `uses_escrow: true`, o
 * que hoje nunca acontece — o escrow ainda não existe. Quando existir, ligar a
 * flag passa a selecionar outra redação e **nenhuma linha de código de cláusula
 * muda**. Era exatamente o objetivo de fazer o contrato antes do escrow.
 *
 * ## Por que não há percentual nem prazo escritos aqui
 *
 * A comissão da plataforma e os prazos de pagamento, de contestação e de
 * liberação **mudam** — por plano, por política comercial, por negociação com o
 * adquirente. Número escrito no corpo de uma cláusula é número que só muda com
 * `show-v2`, e versão nova de template por causa de reajuste de taxa é o
 * caminho errado.
 *
 * A saída não é omitir: é **remeter ao que foi informado e aceito, congelando a
 * data**. Toda remissão desta família diz "vigente na data de emissão deste
 * instrumento" — sem isso, a plataforma poderia mudar a taxa depois da
 * assinatura e alcançar um show já contratado, que é a definição de cláusula
 * potestativa. Com isso, o contrato é determinável (CC art. 594) e imune a
 * mudança superveniente.
 */

export const CACHE_PAGAMENTO_CLAUSE: ClauseDefinition = {
  key: "cache_pagamento",
  category: "preco",
  required: true,
  legal_note:
    "Obrigação principal do CONTRATANTE. O valor aparece em algarismos E por " +
    "extenso — é a defesa clássica contra adulteração de um dígito, e em caso " +
    "de divergência prevalece o extenso. O valor é declarado BRUTO porque a " +
    "cláusula de tributos prevê retenção pelo contratante — sem isso, o " +
    "contrato diria 'R$ 1.500' e o músico receberia menos, que é a briga " +
    "clássica de fim de show. Na variante sem custódia, a plataforma declara " +
    "expressamente que não intermedia o pagamento. " +
    "🔑 Na variante com custódia, três afirmações carregam o peso: (1) o cachê " +
    "é obrigação INTEGRAL do contratante e não é reduzido pela remuneração da " +
    "plataforma — sem isso o bar argumenta que deve o líquido; (2) a comissão " +
    "é devida pelo CONTRATADO e vem do que lhe é liberado, o que é a verdade " +
    "do split e evita que o contrato declare um valor que ninguém recebe; " +
    "(3) o valor custodiado não integra o patrimônio da plataforma. " +
    "⚠️ A afirmação (3) só é verdadeira no caminho de subconta em instituição " +
    "de pagamento. Se o escrow subir com o dinheiro parado na conta da " +
    "própria plataforma, esta redação vira declaração falsa — ver " +
    "Docs/_privado/pagamentos/decisoes-de-gateway.md, decisão pendente de custódia.",
  variants: [
    {
      variant_id: "cache_pagamento.direto.formal",
      tone: "formal",
      applicability: { uses_escrow: false },
      consumes: [
        "cache_formatado",
        "cache_extenso",
        "pagamento_prazo_texto",
        "plataforma_nome",
      ],
      title: "Do valor e da forma de pagamento",
      body: (v) => `
        Pela prestação dos serviços descritos neste instrumento, o CONTRATANTE
        pagará ao CONTRATADO a quantia de ${v.cache_formatado}
        (${v.cache_extenso}), ${v.pagamento_prazo_texto}.

        Parágrafo primeiro. O pagamento será realizado diretamente entre as
        partes, pelo meio que acordarem. A ${v.plataforma_nome} não intermedia,
        não retém e não garante este pagamento, limitando-se a registrar o valor
        acordado.

        Parágrafo segundo. O valor acima é BRUTO. Eventuais retenções tributárias
        exigidas por lei do CONTRATANTE serão deduzidas dele, e o CONTRATADO
        receberá o líquido resultante, com o comprovante da retenção. Não
        havendo retenção legalmente exigível, o valor bruto é o valor a receber.

        Parágrafo terceiro. Havendo divergência entre o valor expresso em
        algarismos e o valor por extenso, prevalecerá este último.

        Parágrafo quarto. O atraso no pagamento sujeitará o CONTRATANTE a
        correção monetária e juros de mora de 1% (um por cento) ao mês,
        calculados pro rata die.
      `,
    },
    {
      variant_id: "cache_pagamento.direto.direto",
      tone: "direto",
      applicability: { uses_escrow: false },
      consumes: [
        "cache_formatado",
        "cache_extenso",
        "pagamento_prazo_texto",
        "plataforma_nome",
      ],
      title: "Do valor e da forma de pagamento",
      body: (v) => `
        O CONTRATANTE paga ao CONTRATADO ${v.cache_formatado}
        (${v.cache_extenso}), ${v.pagamento_prazo_texto}.

        O pagamento é feito diretamente entre as partes. A ${v.plataforma_nome}
        não recebe, não retém e não garante esse dinheiro — apenas registra o
        valor combinado.

        Esse valor é BRUTO: se a lei obrigar o CONTRATANTE a reter algum
        tributo, a retenção sai dele e o CONTRATADO recebe o líquido, com o
        comprovante. Sem retenção obrigatória, o bruto é o que o CONTRATADO
        recebe.

        Se o valor em número e o valor por extenso não baterem, vale o por
        extenso. Atraso no pagamento gera correção monetária e juros de 1% ao
        mês, proporcionais aos dias.
      `,
    },
    {
      variant_id: "cache_pagamento.com_custodia.formal",
      tone: "formal",
      applicability: { uses_escrow: true },
      consumes: [
        "cache_formatado",
        "cache_extenso",
        "plataforma_nome",
        "custodiante_nome",
      ],
      title: "Do valor e do pagamento em custódia",
      body: (v) => {
        const custodiante = req(v.custodiante_nome, "custodiante_nome");

        return `
          Pela prestação dos serviços descritos neste instrumento, o CONTRATANTE
          pagará ao CONTRATADO a quantia de ${v.cache_formatado}
          (${v.cache_extenso}).

          Parágrafo primeiro. O pagamento será realizado integral e
          antecipadamente, antes da data da apresentação, no prazo informado
          pela ${v.plataforma_nome} às partes e vigente na data de emissão deste
          instrumento, permanecendo o valor em custódia junto a ${custodiante},
          instituição de pagamento, até a liberação tratada na cláusula de
          custódia e liberação.

          Parágrafo segundo. O valor custodiado não integra o patrimônio da
          ${v.plataforma_nome}, não é por ela mantido em conta própria e dele
          não pode dispor em proveito próprio.

          Parágrafo terceiro. Não realizado o pagamento no prazo, a contratação
          poderá ser cancelada sem ônus para qualquer das partes, hipótese que
          não se confunde com o cancelamento tratado em cláusula própria e não
          gera a multa nela prevista.

          Parágrafo quarto. O valor acima é a obrigação integral do CONTRATANTE
          e não é reduzido pela remuneração devida à ${v.plataforma_nome}. Esta
          remuneração, pelos serviços de aproximação, formalização e custódia, é
          devida pelo CONTRATADO, deduz-se do valor no momento da liberação e
          corresponde ao percentual que lhe foi informado antes do aceite deste
          instrumento e vigente na data de sua emissão. Alteração posterior não
          alcança esta contratação.

          Parágrafo quinto. O valor acima é BRUTO. Eventuais retenções
          tributárias exigidas por lei do CONTRATANTE serão deduzidas dele, e o
          CONTRATADO receberá o líquido resultante, com o comprovante da
          retenção.

          Parágrafo sexto. Havendo divergência entre o valor expresso em
          algarismos e o valor por extenso, prevalecerá este último.
        `;
      },
    },
  ],
};

/**
 * A contrapartida da custódia: em que condições o dinheiro sai.
 *
 * 🔑 **Esta cláusula é o que transforma "a plataforma segura o dinheiro" em uma
 * promessa exigível pelo músico.** Sem ela, o contrato descreveria a retenção
 * sem descrever a saída — e quem cumpriu a apresentação assinaria um documento
 * que não diz o que precisa fazer para receber.
 *
 * ⚠️ `required: false` é obrigatório aqui, não descuido: uma cláusula
 * `required` sem variante aplicável faz a emissão FALHAR, e nenhuma variante
 * desta se aplica a contrato sem custódia. A garantia de que ela nunca falta
 * num contrato com custódia vem de as duas dependerem da mesma flag
 * `uses_escrow`, e há teste dedicado provando a presença conjunta.
 */
export const CUSTODIA_LIBERACAO_CLAUSE: ClauseDefinition = {
  key: "custodia_liberacao",
  category: "preco",
  required: false,
  legal_note:
    "🔑 A obrigação de guardar o valor e repassá-lo nasce do ato de custodiar, " +
    "é indisponível e NÃO é afastada por cláusula nenhuma — por isso a redação " +
    "a assume em vez de tentar excluí-la. " +
    "A liberação automática do parágrafo segundo é a proteção do músico: sem " +
    "ela, a plataforma poderia reter indefinidamente por inércia, e reter " +
    "valor alheio sem causa é o risco reputacional e jurídico central do " +
    "produto. " +
    "O parágrafo terceiro ressalva o acesso ao Judiciário porque mediação " +
    "redigida como condição de acesso viola a CF art. 5º, XXXV — mesmo " +
    "cuidado da cláusula de resolução de conflitos. " +
    "O parágrafo quinto evita que a liberação seja lida como quitação plena: " +
    "vício na execução continua apurável pelas vias próprias (CC art. 441 e ss.). " +
    "🔴 CONFIRMAR COM ADVOGADO: (a) se a custódia por instituição de pagamento " +
    "com subconta afasta o enquadramento da plataforma como arranjo de " +
    "pagamento sujeito a autorização (Lei 12.865/2013); (b) se a liberação " +
    "automática por decurso de prazo é oponível ao CONTRATANTE que não se " +
    "manifestou; (c) se o prazo de contestação, por remissão a regra publicada, " +
    "resiste à análise de cláusula abusiva — a âncora de data de emissão foi " +
    "posta justamente para isso.",
  variants: [
    {
      variant_id: "custodia_liberacao.padrao.formal",
      tone: "formal",
      applicability: { uses_escrow: true },
      consumes: ["plataforma_nome", "custodiante_nome"],
      title: "Da custódia e da liberação do valor",
      body: (v) => {
        const custodiante = req(v.custodiante_nome, "custodiante_nome");

        return `
          O valor pago pelo CONTRATANTE permanece em custódia junto a
          ${custodiante} e é liberado ao CONTRATADO após a realização da
          apresentação, observadas as condições desta cláusula.

          Parágrafo primeiro. A liberação depende, cumulativamente, do registro
          da realização da apresentação pelo CONTRATADO na plataforma
          ${v.plataforma_nome} e do decurso do prazo de contestação, contado do
          término da apresentação, informado às partes e vigente na data de
          emissão deste instrumento.

          Parágrafo segundo. Decorrido o prazo de contestação sem manifestação
          do CONTRATANTE, a liberação é automática, independentemente de nova
          autorização de qualquer das partes ou de ato discricionário da
          ${v.plataforma_nome}.

          Parágrafo terceiro. A contestação apresentada pelo CONTRATANTE dentro
          do prazo suspende a liberação e instaura a mediação prevista na
          cláusula de resolução de conflitos, limitada ao valor custodiado. A
          suspensão não constitui condição para o acesso às vias judiciais, que
          permanece franqueado a qualquer das partes.

          Parágrafo quarto. Não realizada a apresentação, o valor custodiado
          responde pelas consequências previstas na cláusula de cancelamento,
          restituindo-se o que dela sobejar à parte a quem couber.

          Parágrafo quinto. A ausência de contestação e a consequente liberação
          não implicam quitação de eventual pretensão indenizatória por vício na
          execução, apurável pelas vias próprias.

          Parágrafo sexto. A obrigação da ${v.plataforma_nome} quanto ao valor
          custodiado limita-se a determinar a sua liberação quando verificadas
          as condições acima, não abrangendo garantia de realização da
          apresentação nem de solvência de qualquer das partes.
        `;
      },
    },
  ],
};
