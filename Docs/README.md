# 📚 Documentação SoundMeet — Índice

Backend em **NestJS + DDD + Clean Architecture + Hexagonal**, ORM **Prisma/PostgreSQL**.

> Cada documento tem escopo único. Este índice evita abrir vários arquivos para achar informação.

## Mapa dos documentos

| Documento                                            | Para quê serve                                      | Use quando                          |
| ---------------------------------------------------- | --------------------------------------------------- | ----------------------------------- |
| [architecture.md](architecture.md)                   | Padrão de desenvolvimento (DDD, módulos, stack)     | Criar/alterar código no backend     |
| [features.md](features.md)                           | Visão de produto (músico, público, estabelecimento) | Entender o que a plataforma faz     |
| [business-rules.md](business-rules.md)               | Regras × implementação (`[x]/[~]/[ ]`)              | Saber o que já existe no código     |
| [monetization.md](monetization.md)                   | Receita, planos e preços                            | Decisões de produto/monetização     |
| [roadmap.md](roadmap.md)                             | Estado atual + próximos passos                      | Planejar sprints                    |
| [qr-code.md](qr-code.md)                             | Spec do QR (perfil + validação de scan)             | Implementar/ajustar QR              |
| [payment-gateway-decisions.md](payment-gateway-decisions.md) | Gateways, escrow, chargeback — arquitetura decidida | Mexer em pagamento ou ligar o escrow |
| [payment-gateway-research-2026-08.md](payment-gateway-research-2026-08.md) | 🔴 **A taxa PIX do Asaas é FIXA (R$1,99)** e torna deficitária toda gorjeta abaixo de R$22. Comparativo com Woovi/Mercado Pago/Efí/Pagar.me, restrições operacionais do Asaas e a recomendação de rotear por vértice | **Antes** de escolher gateway ou escrever o F1.0 |
| [auth/keycloak.md](auth/keycloak.md)                 | Realm, clients, roles, groups e claims Keycloak     | Configurar autenticação/autorização |
| [ops/domain-soundmeet-com-br.md](ops/domain-soundmeet-com-br.md) | Domínio Hostinger, DNS, túnel, mapa de chaves MP, Keycloak/Google | Depois de comprar o domínio; webhooks e OAuth |
| [workflow/git-workflow.md](workflow/git-workflow.md) | Git Flow + Conventional Commits                     | Commits e branches                  |

### Contrato digital de show ([contract/](contract/contract-digital.md))

| Documento                                                | Escopo                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| [contract-digital.md](contract/contract-digital.md)      | **Fonte única** — arquitetura do subsistema `contract`        |
| [legal-checklist.md](contract/legal-checklist.md)        | 🔴 O documento que vai ao advogado — **gate para produção**   |

### Apresentação ao vivo ([performance/](performance/live-performance.md))

| Documento                                                     | Escopo                                                      |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| [live-performance.md](performance/live-performance.md)        | **Fonte única** — set ao vivo, currículo verificado, setlist inteligente e relatório pós-show |

### Subsistema de IA musical ([AI-musician/](AI-musician/README.md))

| Documento                                                | Escopo                                           |
| -------------------------------------------------------- | ------------------------------------------------ |
| [pipeline-overview.md](AI-musician/pipeline-overview.md) | Arquitetura MIR, ferramentas, estudo             |
| [chord-sheet.md](AI-musician/chord-sheet.md)             | **Fonte única** — folha de cifra (LRC + acordes) |
| [external-apis.md](AI-musician/external-apis.md)         | Letras LRC e metadados complementares            |
| [audio-separation.md](AI-musician/audio-separation.md)   | Tuning Demucs (segment/overlap)                  |
| [spotify-track-matching.md](AI-musician/spotify-track-matching.md) | **Fonte única** — como a música vira link do Spotify (escolha da versão) |

## Domínios (`src/core`)

`musician` · `establishment` · `audience` · `request` · `gamification` · `payment` · `scheduling` · `events` · `music-library` · `synced-lyrics` · `ai-audio` · `ai-cifra` · `contract` · `personal-chord-sheet` · `performance` · `review` · `shared`

## Configuração Cursor (monorepo)

Regras e skills em `.cursor/rules/` e `.cursor/skills/` na raiz do monorepo. `architecture.md` alimenta a rule `soundmeet-architecture.mdc` (sempre ativa).
