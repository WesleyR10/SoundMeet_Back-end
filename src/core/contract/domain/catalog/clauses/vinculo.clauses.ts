import { ClauseDefinition } from "../clause.types";

/**
 * Autonomia da relação e obrigações de conduta do contratado.
 *
 * 🔴 **A cláusula de ausência de vínculo é necessária e insuficiente.** Vale a
 * primazia da realidade: se os fatos configurarem pessoalidade, habitualidade,
 * onerosidade e subordinação (CLT art. 3º), nenhuma redação afasta o vínculo. O
 * que protege de verdade é a prática — e é por isso que a plataforma inteira
 * deve evitar vocabulário de emprego ("escala", "jornada", "ponto", "folga",
 * "turno do músico") em qualquer tela: essas palavras viram prova contra o
 * próprio produto num litígio.
 */

export const AUSENCIA_VINCULO_CLAUSE: ClauseDefinition = {
  key: "ausencia_vinculo",
  category: "obrigacoes",
  required: true,
  legal_note:
    "CLT art. 3º. Necessária e insuficiente: prevalece a primazia da " +
    "realidade, e nenhuma redação afasta vínculo cujos requisitos os fatos " +
    "configurem. " +
    "🔑 Reescrita em 15/ago/2026 para AFIRMAR em vez de NEGAR. A versão " +
    "anterior negava em cascata ('não configurando relação de emprego, " +
    "sociedade, agenciamento, representação ou qualquer outro vínculo'), usava " +
    "vocabulário de emprego ainda que negado ('sem controle de jornada') e " +
    "empregava jargão trabalhista ('não há pessoalidade obrigatória') — o " +
    "conjunto sinalizava consciência do risco e podia ser lido como tentativa " +
    "de mascarar a relação. " +
    "🔴 Duas afirmações de FATO foram removidas por serem falsificáveis: " +
    "'em caráter eventual' e 'sem controle de jornada'. Um contrato que afirma " +
    "eventualidade num show que se repete toda semana declara algo falso, e " +
    "declaração falsa é pior que declaração ausente — vira prova contra quem a " +
    "escreveu. O que sobrou são fatos verificáveis: quem define repertório e " +
    "técnica, a possibilidade de substituição e a ausência de exclusividade. " +
    "⚠️ A exclusividade é declarada porque é verdade no produto, NÃO porque " +
    "afaste vínculo: a jurisprudência é firme em que exclusividade não é " +
    "requisito, e o obreiro pode ter vários empregadores. " +
    "⚠️ Confirmar com advogado: (a) o enquadramento frente à Lei 6.533/1978; " +
    "(b) o critério de eventualidade da tradição da Nota Contratual — até 7 " +
    "dias consecutivos, com intervalo antes de reutilizar o mesmo profissional " +
    "(Portaria MTE 3.347/86, revogada pela Portaria 656/2018, status atual a " +
    "verificar); (c) se contratação recorrente pede variante própria — ver a " +
    "pendência registrada em `Docs/_privado/juridico/checklist-juridico-do-contrato.md` §10.",
  variants: [
    {
      variant_id: "ausencia_vinculo.padrao.formal",
      tone: "formal",
      applicability: {},
      consumes: [],
      title: "Da natureza autônoma da contratação",
      body: () => `
        As partes ajustam prestação de serviços artísticos de natureza civil,
        nos termos dos arts. 593 e seguintes do Código Civil, não se
        estabelecendo entre elas relação de emprego.

        Parágrafo primeiro. O CONTRATADO define o repertório, a técnica e os
        meios de execução da apresentação, podendo fazer-se substituir na forma
        prevista neste instrumento.

        Parágrafo segundo. Não há exclusividade entre as partes, que podem
        contratar livremente com terceiros.
      `,
    },
  ],
};

export const SUBSTITUICAO_INTEGRANTES_CLAUSE: ClauseDefinition = {
  key: "substituicao_integrantes",
  category: "obrigacoes",
  required: false,
  legal_note:
    "Só se aplica a contratação de banda. Cumpre duas funções: dá previsi- " +
    "bilidade ao CONTRATANTE (que contratou uma formação) e, ao admitir " +
    "substituição, ajuda a afastar a pessoalidade que caracteriza vínculo " +
    "empregatício. O aviso prévio evita a substituição descoberta no palco.",
  variants: [
    {
      variant_id: "substituicao_integrantes.banda.formal",
      tone: "formal",
      applicability: { target: "band" },
      consumes: ["contratado_nome"],
      title: "Da substituição de integrantes",
      body: (v) => `
        O CONTRATADO poderá substituir integrantes do grupo ${v.contratado_nome}
        indicados neste instrumento, desde que mantidos a formação instrumental,
        o repertório e o padrão técnico contratados.

        Parágrafo primeiro. A substituição será comunicada ao CONTRATANTE com
        antecedência mínima de 24 (vinte e quatro) horas do início da
        apresentação, salvo caso fortuito ou força maior, hipótese em que a
        comunicação será imediata.

        Parágrafo segundo. A substituição da maioria dos integrantes indicados
        depende de anuência expressa do CONTRATANTE; recusada a anuência, o
        contrato poderá ser resolvido sem penalidade para qualquer das partes.

        Parágrafo terceiro. O CONTRATADO permanece integralmente responsável
        perante o CONTRATANTE pela atuação dos integrantes substitutos.
      `,
    },
  ],
};

export const CONDUTA_CLAUSE: ClauseDefinition = {
  key: "conduta",
  category: "obrigacoes",
  required: false,
  legal_note:
    "⚠️ Cláusula deliberadamente AUSENTE do tom padrão. Regra de conduta " +
    "detalhada aproxima a relação de subordinação — exatamente o que a " +
    "cláusula de ausência de vínculo tenta afastar — e, em contratação " +
    "artística, soa como imposição patronal. Só entra no tom rigoroso, quando " +
    "o CONTRATANTE assume esse custo conscientemente, e ainda assim limitada a " +
    "obrigações de resultado e respeito mútuo, sem controle de conduta pessoal.",
  variants: [
    {
      variant_id: "conduta.rigorosa.rigoroso",
      tone: "rigoroso",
      applicability: {},
      consumes: [],
      title: "Da conduta durante a apresentação",
      body: () => `
        O CONTRATADO obriga-se a executar a apresentação em condições plenas de
        desempenho e a tratar com urbanidade o público, os funcionários do
        estabelecimento e os demais profissionais envolvidos.

        Parágrafo primeiro. O CONTRATANTE obriga-se, reciprocamente, a assegurar
        ao CONTRATADO ambiente de trabalho respeitoso e livre de assédio ou
        discriminação de qualquer natureza, cabendo-lhe adotar as providências
        necessárias diante de conduta abusiva de terceiros.

        Parágrafo segundo. A interrupção da apresentação por conduta que exponha
        a risco a integridade física do CONTRATADO ou de seus integrantes não
        configura descumprimento contratual e não autoriza retenção do valor
        devido.
      `,
    },
  ],
};
