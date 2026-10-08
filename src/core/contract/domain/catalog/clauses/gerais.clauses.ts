import { ClauseDefinition } from "../clause.types";
import { req } from "../clause-helpers";

/**
 * Cláusulas de fechamento — e as duas que sustentam o produto inteiro.
 *
 * `assinatura_eletronica` e `papel_da_plataforma` não são formalidade: a
 * primeira é o que dá base legal à assinatura própria, e a segunda é o que
 * separa a SoundMeet das obrigações das partes. Se alguma das duas sair do
 * documento, o que sobra é um PDF bonito sem eficácia.
 */

export const ASSINATURA_ELETRONICA_CLAUSE: ClauseDefinition = {
  key: "assinatura_eletronica",
  category: "gerais",
  required: true,
  legal_note:
    "🔑 MP 2.200-2/2001, art. 10, §2º: documento eletrônico assinado por meio " +
    "diverso do ICP-Brasil é válido DESDE QUE admitido como válido pelas " +
    "partes. Esta cláusula é essa admissão — sem ela, a base legal da " +
    "assinatura própria fica frágil, e é por isso que ela é `required` e não " +
    "tem variante. O parágrafo sobre título executivo é honestidade " +
    "deliberada: sem duas testemunhas (CPC art. 784, III) nem certificado " +
    "ICP-Brasil, o documento é prova escrita apta a ação monitória (CPC art. " +
    "700). " +
    "⚠️ A redação AFIRMA que é prova escrita apta a monitória e NÃO nega ser " +
    "título executivo (decisão de 15/ago/2026). A negação expressa entregava " +
    "ao adversário um argumento escrito pelo próprio credor e RENUNCIAVA a " +
    "algo que talvez a lei permitisse — a Lei 14.620/2023 teria incluído um " +
    "§4º no art. 784 do CPC dispensando testemunhas quando a integridade for " +
    "conferida por provedor de assinatura (⚠️ confirmar existência e alcance " +
    "com advogado). Dizer o que o instrumento É basta; a honestidade sobre o " +
    "limite é obrigação da INTERFACE, que nunca promete força executiva.",
  variants: [
    {
      variant_id: "assinatura_eletronica.padrao.formal",
      tone: "formal",
      applicability: {},
      consumes: ["plataforma_nome", "codigo_verificacao", "url_verificacao"],
      title: "Da assinatura eletrônica e da integridade do instrumento",
      body: (v) => `
        As partes reconhecem expressamente a validade, a autenticidade e a
        eficácia da assinatura eletrônica deste instrumento, realizada por meio
        da plataforma ${v.plataforma_nome}, nos termos do art. 10, §2º, da
        Medida Provisória nº 2.200-2/2001, dispensando-se assinatura física,
        certificação ICP-Brasil e a presença de testemunhas para os fins aqui
        ajustados.

        Parágrafo primeiro. Considera-se assinatura o aceite eletrônico
        manifestado de forma expressa e inequívoca por cada parte, mediante
        identificação autenticada, registrando-se data, hora, endereço de rede e
        agente de acesso, na forma do Anexo II — Certificado de Assinatura.

        Parágrafo segundo. A integridade do conteúdo é aferível pelo resumo
        criptográfico (SHA-256) registrado no Anexo II e pelo código de
        verificação ${v.codigo_verificacao}, consultável em
        ${v.url_verificacao}. Qualquer alteração no conteúdo produz resumo
        distinto e é, por isso, detectável.

        Parágrafo terceiro. As partes reconhecem que este instrumento constitui
        prova escrita da obrigação, apta a instruir ação monitória nos termos do
        art. 700 do Código de Processo Civil.
      `,
    },
  ],
};

export const PAPEL_DA_PLATAFORMA_CLAUSE: ClauseDefinition = {
  key: "papel_da_plataforma",
  category: "gerais",
  required: true,
  legal_note:
    "🔑 Delimita o que é e o que não é responsabilidade da SoundMeet. A " +
    "plataforma NÃO é parte, não é empregadora, não é agente ou empresária " +
    "artística, não garante a realização do show. A variante com custódia " +
    "declara o que ela passa a fazer — e a obrigação de determinar a liberação " +
    "nasce do serviço efetivamente prestado, é indisponível e NÃO é afastada " +
    "por cláusula nenhuma; por isso a redação a assume em vez de tentar " +
    "excluí-la. " +
    "⚠️ O parágrafo segundo da variante com custódia afirma que o valor não " +
    "integra o patrimônio da plataforma. Isso é VERDADE apenas no caminho de " +
    "subconta em instituição de pagamento. Ligar `uses_escrow: true` com o " +
    "dinheiro parado em conta da própria SoundMeet transforma esta cláusula em " +
    "declaração falsa — ver Docs/_privado/pagamentos/decisoes-de-gateway.md.",
  variants: [
    {
      variant_id: "papel_da_plataforma.sem_custodia.formal",
      tone: "formal",
      applicability: { uses_escrow: false },
      consumes: ["plataforma_nome", "plataforma_documento"],
      title: "Do papel da plataforma",
      body: (v) => `
        Este contrato é celebrado exclusivamente entre CONTRATANTE e CONTRATADO.
        A ${v.plataforma_nome}, inscrita no CNPJ sob o nº
        ${v.plataforma_documento}, atua unicamente como provedora da ferramenta
        tecnológica que aproximou as partes, gerou este instrumento e guarda o
        respectivo registro.

        Parágrafo primeiro. A ${v.plataforma_nome} não é parte deste contrato,
        não é empregadora, agente, empresária ou representante de qualquer das
        partes, não intermedia o pagamento, não garante a realização da
        apresentação, o seu resultado artístico ou o comparecimento de público, e
        não responde pelas obrigações aqui assumidas.

        Parágrafo segundo. São obrigações próprias da ${v.plataforma_nome},
        perante as partes: manter o instrumento e a respectiva trilha de
        auditoria íntegros e disponíveis, e disponibilizar canal de mediação
        prévia em caso de divergência.

        Parágrafo terceiro. A verificação de documentos apresentados pelas
        partes limita-se à consistência formal, não implicando conferência de
        veracidade, capacidade civil ou poderes de representação.
      `,
    },
    {
      variant_id: "papel_da_plataforma.com_custodia.formal",
      tone: "formal",
      applicability: { uses_escrow: true },
      consumes: ["plataforma_nome", "plataforma_documento", "custodiante_nome"],
      title: "Do papel da plataforma e da custódia de valores",
      body: (v) => {
        const custodiante = req(v.custodiante_nome, "custodiante_nome");

        return `
          Este contrato é celebrado exclusivamente entre CONTRATANTE e
          CONTRATADO. A ${v.plataforma_nome}, inscrita no CNPJ sob o nº
          ${v.plataforma_documento}, atua como provedora da ferramenta
          tecnológica que aproximou as partes, gerou este instrumento, guarda o
          respectivo registro e determina, verificadas as condições ajustadas, a
          liberação do valor mantido em custódia junto a ${custodiante}.

          Parágrafo primeiro. A ${v.plataforma_nome} não é parte deste contrato,
          não é empregadora, agente, empresária ou representante de qualquer das
          partes, não garante a realização da apresentação, o seu resultado
          artístico ou o comparecimento de público, e não responde pelas
          obrigações aqui assumidas.

          Parágrafo segundo. O valor do cachê é custodiado por ${custodiante},
          instituição de pagamento, e não integra o patrimônio da
          ${v.plataforma_nome} nem é mantido em conta de sua titularidade.

          Parágrafo terceiro. São obrigações próprias da ${v.plataforma_nome},
          perante as partes: determinar a liberação do valor custodiado quando
          verificadas as condições da cláusula de custódia e liberação; manter o
          instrumento e a respectiva trilha de auditoria íntegros e disponíveis;
          e disponibilizar canal de mediação prévia em caso de divergência.
          Estas obrigações decorrem dos serviços efetivamente prestados e não
          são afastadas por este contrato.

          Parágrafo quarto. A remuneração da ${v.plataforma_nome} é devida
          somente na liberação do valor custodiado. Não realizada a
          apresentação, não há liberação e nenhuma remuneração lhe é devida por
          esta contratação.

          Parágrafo quinto. A verificação de documentos apresentados pelas
          partes limita-se à consistência formal, não implicando conferência de
          veracidade, capacidade civil ou poderes de representação.
        `;
      },
    },
  ],
};

export const RESOLUCAO_CONFLITOS_FORO_CLAUSE: ClauseDefinition = {
  key: "resolucao_conflitos_foro",
  category: "gerais",
  required: true,
  legal_note:
    "CPC art. 63 admite foro de eleição entre partes civis. A escolha é a " +
    "comarca do LOCAL DO SHOW — neutra e conectada ao fato — e nunca a sede da " +
    "plataforma, que não é parte e cujo foro não teria nenhuma conexão com a " +
    "obrigação. A mediação prévia é etapa facultativa e não pode ser redigida " +
    "como condição de acesso ao Judiciário (CF art. 5º, XXXV).",
  variants: [
    {
      variant_id: "resolucao_conflitos_foro.padrao.formal",
      tone: "formal",
      applicability: {},
      consumes: ["comarca", "plataforma_nome"],
      title: "Da resolução de conflitos e do foro",
      body: (v) => `
        Havendo divergência quanto à execução deste contrato, as partes
        procurarão resolvê-la de boa-fé, podendo utilizar o canal de mediação
        disponibilizado pela ${v.plataforma_nome}, cuja adesão é facultativa e
        não constitui condição para o acesso às vias judiciais.

        Parágrafo único. Persistindo a divergência, fica eleito o foro da
        comarca de ${v.comarca}, local da apresentação, com renúncia a qualquer
        outro, por mais privilegiado que seja.
      `,
    },
  ],
};

export const DISPOSICOES_GERAIS_CLAUSE: ClauseDefinition = {
  key: "disposicoes_gerais",
  category: "gerais",
  required: true,
  legal_note:
    "Fechamento padrão: integralidade do ajuste, nulidade parcial que não " +
    "contamina o todo (CC art. 184), tolerância que não gera novação, e a " +
    "incorporação expressa dos anexos — sem a qual a Ficha Técnica do Anexo I " +
    "seria apenas um documento anexado, não parte do contrato.",
  variants: [
    {
      variant_id: "disposicoes_gerais.padrao.formal",
      tone: "formal",
      applicability: {},
      consumes: ["emitido_em"],
      title: "Das disposições gerais",
      body: (v) => `
        Este instrumento, com seus anexos, representa a integralidade do ajuste
        entre as partes quanto à apresentação nele descrita, substituindo
        quaisquer tratativas anteriores, verbais ou escritas.

        Parágrafo primeiro. Os anexos que acompanham este instrumento integram-no
        para todos os fins de direito.

        Parágrafo segundo. A eventual nulidade ou ineficácia de qualquer
        disposição não prejudica as demais, que permanecem em pleno vigor.

        Parágrafo terceiro. A tolerância de qualquer das partes quanto ao
        descumprimento de obrigação pela outra constitui mera liberalidade, não
        implicando novação, renúncia ou alteração do ajustado.

        Parágrafo quarto. Alterações a este contrato somente terão validade se
        formalizadas por termo aditivo aceito por ambas as partes pelo mesmo
        meio eletrônico, preservando-se a integridade do instrumento original,
        emitido em ${v.emitido_em}.
      `,
    },
  ],
};
