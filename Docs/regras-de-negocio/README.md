# Regras de negócio

O que a API já faz, **domínio por domínio**, cruzado com o código. Antes de implementar algo,
abra o arquivo do domínio: se a regra já existe, ela está marcada aqui.

Marcações:

- `[x]` Implementado (com o arquivo de código ao lado)
- `[~]` Parcialmente implementado (há estrutura, mas falta completar)
- `[ ]` Ainda não implementado

Os `[N]` ao longo do texto são atalhos para o arquivo de código, listados no fim de cada documento.

> Até 03/out/2026 isto tudo era um arquivo só, `Docs/business-rules.md` (2.070 linhas). Foi dividido
> sem cortar texto: cada seção foi para o arquivo do seu domínio, e o título original ficou anotado
> no topo de cada uma.

---

## Por domínio

| Arquivo | O que tem |
|---|---|
| [cadastro-e-login.md](cadastro-e-login.md) | Registro, login por senha e Google, cadastro de estabelecimento, a invariante `id == sub` |
| [musico-e-banda.md](musico-e-banda.md) | Perfil, QR permanente, gêneros e instrumentos, bandas e divisão de gorjeta, destaque pago na busca, tempo de estrada, áudio de apresentação |
| [estabelecimento.md](estabelecimento.md) | Cadastro da casa, QR permanente, CNPJ, avaliação, verificação, eventos e campanhas |
| [chat-e-negociacao.md](chat-e-negociacao.md) | As duas portas da conversa e a proposta feita dentro dela |
| [agenda-e-contratacao.md](agenda-e-contratacao.md) | Booking, proposta e contraproposta, disponibilidade, limite de shows por dia, Google Agenda |
| [publico.md](publico.md) | O fã: perfil, pontos e níveis, votação, limite anti-spam de pedidos, recomendações |
| [pedidos-de-musica.md](pedidos-de-musica.md) | Pedido ao palco, presença verificada, escopo do pedido, destaque pago |
| [pagamentos-e-carteira.md](pagamentos-e-carteira.md) | Gorjeta (Mercado Pago), carteira, saque PIX, custódia do cachê, check-in |
| [gamificacao.md](gamificacao.md) | Pontos, badges, rankings |
| [avaliacoes.md](avaliacoes.md) | Avaliações e onde cada uma aparece em cada cliente |
| [cifra-pessoal.md](cifra-pessoal.md) | Cifra pessoal do músico, comunidade e moderação |
| [contrato.md](contrato.md) | Contrato digital de show: catálogo de cláusulas, emissão, assinatura |
| [ponte-spotify.md](ponte-spotify.md) | O fã salva no Spotify o que ouviu |
| [apresentacao-ao-vivo.md](apresentacao-ao-vivo.md) | Set ao vivo, tocando agora, relatório, currículo, setlist, Modo Ensaio, noites do período |
| [indicacao-de-talentos.md](indicacao-de-talentos.md) | O fã indica artista para a casa; compartilhamento social |
| [seguir-musico-e-casa.md](seguir-musico-e-casa.md) | Seguir e os avisos no celular |
| [ainda-nao-implementado.md](ainda-nao-implementado.md) | Blocos da visão do produto que ainda não têm código |

A política HTTP da API inteira (CORS, Swagger, Helmet, container) não é de um domínio e está em
[../arquitetura/seguranca-http-e-container.md](../arquitetura/seguranca-http-e-container.md).

## Domínios sem arquivo próprio

Estes domínios existem em `src/core/` mas suas regras ainda não foram escritas aqui. Antes de mexer
em um deles, a fonte é o código (agregado + testes de domínio) e o doc indicado; ao documentar,
crie o arquivo do domínio nesta pasta e acrescente-o à tabela acima.

| Domínio | Onde está documentado hoje |
|---|---|
| `events` | Espalhado: presença e check-in em [pedidos-de-musica.md](pedidos-de-musica.md); set ao vivo em [apresentacao-ao-vivo.md](apresentacao-ao-vivo.md) e [../funcionalidades/apresentacao-ao-vivo-set-e-relatorio.md](../funcionalidades/apresentacao-ao-vivo-set-e-relatorio.md) |
| `campaign` | Só o código (`src/core/campaign/`, CRUD) |
| `plans` | Gates de plano espalhados pelos arquivos; tiers e preços são documento interno |
| `repertoire` / `music-library` | [../ia-musical/folha-de-cifra.md](../ia-musical/folha-de-cifra.md) e "Escopo do pedido" em [pedidos-de-musica.md](pedidos-de-musica.md) |
| `synced-lyrics` / `ai-cifra` | [../ia-musical/folha-de-cifra.md](../ia-musical/folha-de-cifra.md) |
| `ai-audio` | [../ia-musical/modo-ensaio.md](../ia-musical/modo-ensaio.md) |

## Como manter

- Regra nova ou alterada → atualize o arquivo do domínio no mesmo PR (está na definição de pronto).
- Assunto que atravessa domínios → escreva onde a regra **mora** no código e deixe uma linha
  apontando nos outros, em vez de repetir o texto.
- Desenho técnico longo de uma funcionalidade (por que a arquitetura é assim, alternativas
  descartadas) vai em [../funcionalidades/](../funcionalidades/); aqui fica o que a regra é.
