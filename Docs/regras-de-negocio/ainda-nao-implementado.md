# Ainda não implementado

> Parte das [regras de negócio](../README.md) — o que a API já faz, por domínio.
> Marcações: `[x]` implementado · `[~]` parcial · `[ ]` pendente.

*Seção original: “Funcionalidades Planejadas Ainda Não Implementadas”.*


Além dos pontos marcados como `[ ]` e `[~]` acima, os seguintes blocos de funcionalidades do documento de visão **ainda não possuem implementação direta** no backend atual:

- Marketplace com Reels/Vídeos (upload, streaming, revenue sharing por views)
- Sistema de “Memórias Musicais” (álbum de momentos, timeline pessoal, analytics visuais)
- Integrações externas completas:
  - Export MusicXML da folha de cifra
  - Verificação automática de compartilhamentos sociais via APIs
  - Integrações de analytics (GA4, Pixel, social listening)
- Segmentação avançada por instrumentos e proximidade com feed de Reels
- Matching inteligente para formação de bandas (ML, score de compatibilidade, jam virtual)
- Programas especiais de carreira, talent shows virtuais e parcerias avançadas de marketplace
- Billing do marketplace

## Lacunas encontradas na auditoria das rotas de músico *(08/out/2026)*

- [ ] 🔴 **Excluir conta.** Não existe em nenhum cliente, e o `DELETE /musicians/:id` que havia
      foi removido por ser um `repository.delete` com cascata (ver
      [musico-e-banda.md](musico-e-banda.md)). **É gate de publicação nas lojas:** a Apple
      (diretriz 5.1.1(v)) exige exclusão iniciada dentro do app, e o Google Play exige o caminho no
      app e um link web. O fluxo precisa decidir o que bloqueia (custódia retida, contrato
      vigente), o que é anonimizado, o que a lei manda guardar, e encerrar login, assinatura e
      arquivos — não só a linha do banco. O mesmo vale para `DELETE /audiences/:id`.
- [ ] **Desativar e desverificar músico por rota administrativa.** `deactivate` e `unverify`
      existem no agregado e nenhuma rota os chama.
- [ ] **Intervalo mínimo na troca de e-mail.** Cada `PATCH` com e-mail novo dispara um e-mail de
      verificação; uma conta manda até 100 por minuto (o limite global) para endereços de
      terceiros. Vale para músico, público e estabelecimento (`mail-event.handler.ts`).
- [ ] **Convite de banda e de repertório para quem está fora do radar.** As duas telas buscam por
      `GET /musicians`, que só devolve quem ligou "disponível para shows"; um colega com o radar
      desligado (ou ainda sem decidir) não pode ser convidado. O app explica isso na tela. Caminho
      sugerido: convite por QR ou link do perfil, que não torna ninguém achável.
- [ ] **Apagar o token de push do público no logout.** O do músico é apagado; a porta
      `IAudiencePushTokenStore` só tem `save`.
- [x] ~~Rota em lote para identidade de banda.~~ Feita em 08/out/2026: `GET /bands/identities`.
- [ ] O nome de cadastro (`name`) sai no presenter público ao lado do nome artístico. Falta
      decidir se é dado público.

## Lacunas encontradas na auditoria das rotas de banda *(08/out/2026)*

- [ ] **Desarquivar banda.** Banda dissolvida com histórico fica arquivada e não há rota para
      reativá-la. Decidir antes se a volta reaproveita os integrantes ou exige novos convites.
- [ ] **Foto da banda.** `bands.avatar` existe e não tem upload; a URL livre que o `PATCH`
      aceitava foi removida. Falta a rota, nos moldes de `POST /musicians/:id/avatar` (com a
      chave do objeto desde o primeiro dia).
- [ ] **Instrumento do integrante depois do convite.** O líder nasce com instrumento `"N/A"` e
      nenhuma rota o altera; o instrumento de um integrante só muda removendo e reconvidando.
      Os clientes tratam `"N/A"` como ausência.
- [ ] **QR da banda.** `bands.qr_code` existe no schema e no agregado, e nada o escreve nem lê.
- [ ] **Integrantes verem a agenda da banda.** Só o líder tem o claim `band_ids`, então só ele
      vê shows, contratos e conversas da banda. Dar o claim a todo integrante exige decidir o
      que cada um lê em `contract` e `chat`.
- [ ] **A faixa de preço da banda não tem tela.** A API grava e a busca filtra; o app não tem
      onde o líder a informe.
- [ ] **Renovar a sessão da nova líder na transferência.** Ela altera a banda na hora, mas só
      enxerga os shows da banda quando o token renova (até 15 min).

Esses itens estão descritos em [visao-do-produto.md](../_privado/produto/visao-do-produto.md) ([1]), e o código atual fornece boa parte da base de domínio (QR codes, pedidos, gorjetas, gamificação, rankings). Porém ainda serão necessários novos agregados, use-cases e integrações de infraestrutura para chegar à visão completa da plataforma.

[1]: ../_privado/produto/visao-do-produto.md