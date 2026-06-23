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
| [auth/keycloak.md](auth/keycloak.md)                 | Realm, clients, roles, groups e claims Keycloak     | Configurar autenticação/autorização |
| [workflow/git-workflow.md](workflow/git-workflow.md) | Git Flow + Conventional Commits                     | Commits e branches                  |

### Subsistema de IA musical ([AI-musician/](AI-musician/README.md))

| Documento                                                | Escopo                                           |
| -------------------------------------------------------- | ------------------------------------------------ |
| [pipeline-overview.md](AI-musician/pipeline-overview.md) | Arquitetura MIR, ferramentas, estudo             |
| [chord-sheet.md](AI-musician/chord-sheet.md)             | **Fonte única** — folha de cifra (LRC + acordes) |
| [external-apis.md](AI-musician/external-apis.md)         | Letras LRC e metadados complementares            |
| [audio-separation.md](AI-musician/audio-separation.md)   | Tuning Demucs (segment/overlap)                  |

## Domínios (`src/core`)

`musician` · `establishment` · `audience` · `request` · `gamification` · `payment` · `scheduling` · `events` · `music-library` · `synced-lyrics` · `ai-audio` · `ai-cifra` · `shared`

## Configuração Cursor (monorepo)

Regras e skills em `.cursor/rules/` e `.cursor/skills/` na raiz do monorepo. `architecture.md` alimenta a rule `soundmeet-architecture.mdc` (sempre ativa).
