# syntax=docker/dockerfile:1

# ═══════════════════════════════════════════════════════════════════════════
# Keycloak de DESENVOLVIMENTO com o tema SoundMeet assado na imagem.
#
# ## Por que o jar é COPIADO e não montado por volume
#
# Até 09/set/2026 o `docker-compose.yml` montava
# `soundmeet-keycloak-theme/dist_keycloak/*.jar` em
# `/opt/keycloak/providers/soundmeet-theme.jar` como bind mount de ARQUIVO
# ÚNICO. Isso funciona até o Docker Desktop perder a visão do filesystem da
# distro WSL — e aí o mount entrega um DIRETÓRIO VAZIO no lugar do arquivo. O
# sintoma não é um erro de volume: é o Quarkus abortando o `kc.sh build` com
# `FileNotFoundException: .../soundmeet-theme.jar (Is a directory)`, e o
# container em crash-loop. Aconteceu duas vezes no mesmo dia, e reiniciar o
# Docker Desktop só resolveu na primeira.
#
# O build context não passa por bind mount (o contexto é enviado ao daemon como
# um stream), então esta imagem sobe mesmo com a integração degradada. É também
# o caminho que `infra/keycloak/docker-compose.prod.yml` já recomendava em
# comentário: *"o caminho recomendado aí é assar o tema numa imagem própria"*.
#
# O `realm-soundmeet.json` entra pelo mesmo motivo: ele também era bind mount de
# arquivo único e quebrava junto. Assá-lo é seguro porque o arquivo só é lido no
# `--import-realm`, ou seja, no PRIMEIRO boot com o banco vazio — depois disso
# quem aplica mudança de realm é `npm run keycloak:sync`, pela API REST, sem
# tocar no arquivo.
#
# ## Build
#   cd soundmeet-keycloak-theme && npm ci && npm run build-keycloak-theme
#   docker compose build keycloak     # a partir de soundmeet-backend/
#
# ⚠️ O tema é assado em BUILD: depois de mexer no `soundmeet-keycloak-theme`,
# reconstrua a imagem (`docker compose up -d --build keycloak`). Um
# `--force-recreate` sozinho reusa a imagem antiga e o tema não muda — sem erro
# nenhum, que é o modo de falha caro.
# ═══════════════════════════════════════════════════════════════════════════
FROM quay.io/keycloak/keycloak:22.0

# 🔴 O jar `22-to-25`, NUNCA o `all-other-versions`.
# A imagem acima é a 22.0; o outro jar cobre 11–21 e 26+. Trocar os dois não dá
# erro: o Keycloak sobe normalmente e simplesmente IGNORA o tema.
# (O `docker-compose.prod.yml` usa o oposto, porque lá a imagem é a 26.4.)
# `--from=theme` é um CONTEXTO ADICIONAL, declarado no compose. Existe porque o
# jar e o realm.json vivem em árvores diferentes do monorepo, e `COPY` não pode
# sair do contexto — a alternativa seria usar a raiz do monorepo como contexto,
# enviando o repositório inteiro ao daemon a cada build.
COPY --from=theme keycloak-theme-for-kc-22-to-25.jar /opt/keycloak/providers/soundmeet-theme.jar

COPY realm-soundmeet.json /opt/keycloak/data/import/realm-soundmeet.json
