# Usuários de teste criados pelo seed

> Pasta [autenticacao/](./): [keycloak.md](keycloak.md) (realm, clients, papéis, claims) ·
> [autorizacao-e-ownership.md](autorizacao-e-ownership.md) (proteger uma rota) ·
> [login-e-cadastro.md](login-e-cadastro.md) (os fluxos de entrada) ·
> [usuarios-de-teste.md](usuarios-de-teste.md) (logins do seed).

`npm run seed -- --reset` cria **15 usuarios no Keycloak**, todos com a mesma senha.

> **Senha: `Seed@123`** — constante `KEYCLOAK_SEED_PASSWORD` em `prisma/seed.ts`.

| Persona | E-mails | Papel de realm | Observacao |
|---|---|---|---|
| Musicos | `musico1@seed-soundmeet.com` … `musico8@seed-soundmeet.com` | `musician` | O `sub` do Keycloak **vira o id do aggregate**, igual ao `RegisterUseCase`. `musico1` (Joao) e o mais completo: carteira com extrato, banda, cifras pessoais, shows |
| Fas | `fa1@seed-soundmeet.com` e `fa2@seed-soundmeet.com` | `audience` | Mesmo tratamento: `sub` = `audience_id` |
| Estabelecimentos | `bar1@seed-soundmeet.com` `rest1@seed-soundmeet.com` `club1@seed-soundmeet.com` `bar2@seed-soundmeet.com` | `establishment` | 🔴 O `sub` **NAO** e o id do estabelecimento — ele tem UUID proprio, e o seed escreve o claim `establishment_ids` apos criar o aggregate |
| Admin | `admin@seed-soundmeet.com` | `admin` | Unico SEM aggregate no banco, de proposito: e papel de operacao, nao persona. Existe porque 12 rotas `@Roles("admin")` (takedown de cifra da comunidade, gestao de badges, anular contrato) nao tinham como ser exercidas. `support` segue no realm e fora do seed — nenhuma rota o exige ainda |

Todos no dominio `@seed-soundmeet.com`, deterministico por desenho.

**Quem é quem** (os casos que mais aparecem em teste):

| Login | Persona | Útil para |
|---|---|---|
| `musico1` | João Violão | O mais completo: carteira com saldo sacável, banda (líder do Blues Duo), cifras pessoais, set ao vivo |
| `musico3` | Carlos Teclas (PRO) | Analytics com ~55 noites em 6 meses; aceita pedido só do repertório |
| `musico8` | Helena Clássica | **E-mail não confirmado** de propósito — exercita o bloqueio de saque (`EMAIL_NOT_VERIFIED`) |
| `fa1`, `fa2` | Ana Fã, Bruno Superfã | Lado do público: pedidos, gorjetas, gamificação |
| `bar1` | Bar do Zé | Estabelecimento pago, com analytics de 180 dias e cardápio em PDF |
| `rest1` | Restaurante Maresia | Estabelecimento **FREE** — exercita o 402 do analytics |
| `club1` | Lapa Music Hall | Palco ao vivo com o set da Ana (`musico4`) tocando — o cartaz da Home do fã |
| `bar2` | Savassi Jazz Bar | Estabelecimento sem cardápio em PDF |
| `admin` | Admin SoundMeet | Rotas `@Roles("admin")` |

## Duas coisas que quebram sem aviso

🔴 **Sem Keycloak de pe, o seed conclui mesmo assim** — em modo degradado: ids aleatorios, nenhum
claim escrito, e a ultima linha do log avisa. Nao e falha silenciosa, mas e facil de nao ler. Se o
app responder 403 em toda rota de escrita depois de um seed, foi isso.

🔴 **O seed APAGA o usuario anterior com o mesmo e-mail** antes de recriar. E proposital: o
aggregate e regerado a cada `--reset` e o `sub` antigo deixaria de casar com o novo id nos ownership
guards. Consequencia pratica: **todo `--reset` invalida as sessoes abertas no app** — refaca o login
depois de semear.

## Por que o estabelecimento e diferente

Musico e fa herdam o `sub` como id do aggregate. Estabelecimento nao: uma conta pode operar mais de
uma casa, e por isso a autorizacao vem do claim `establishment_ids` (ver "Multi-tenancy e
permissionamento contextual"). Quem autoriza a escrita e o `EstablishmentOwnershipGuard` lendo o
claim, nunca o `sub`.
