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

Esses itens estão descritos em [visao-do-produto.md](../_privado/produto/visao-do-produto.md) ([1]), e o código atual fornece boa parte da base de domínio (QR codes, pedidos, gorjetas, gamificação, rankings). Porém ainda serão necessários novos agregados, use-cases e integrações de infraestrutura para chegar à visão completa da plataforma.

[1]: ../_privado/produto/visao-do-produto.md