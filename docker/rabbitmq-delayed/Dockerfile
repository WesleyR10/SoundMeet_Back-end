FROM rabbitmq:3.12-management-alpine

# SM-020 — o plugin é código que roda dentro do broker, e vem da internet no
# momento do build.
#
# 🔴 `ADD <url>` não verifica nada: se o release for substituído, a conta do
# mantenedor for comprometida ou um proxy no caminho trocar o corpo da resposta,
# o broker carrega o artefato adulterado sem um aviso sequer — e um plugin do
# RabbitMQ tem acesso a toda mensagem que trafega pelo sistema. Baixar e
# CONFERIR o SHA-256 antes de habilitar transforma isso num build que falha em
# vez de num comprometimento silencioso.
#
# Para atualizar a versão, troque as duas variáveis JUNTAS e recalcule o hash
# com `sha256sum` sobre o arquivo baixado. Um hash desatualizado quebra o build,
# que é exatamente o comportamento desejado.
ARG PLUGIN_VERSION=3.12.0
ARG PLUGIN_SHA256=47e5d1a959c71ed0b70b5b32fa57ca9dff6e75541528a1038b92d3af2bdf46b9

USER root

RUN set -eux; \
    plugin="rabbitmq_delayed_message_exchange-${PLUGIN_VERSION}.ez"; \
    wget -qO "/plugins/${plugin}" \
      "https://github.com/rabbitmq/rabbitmq-delayed-message-exchange/releases/download/v${PLUGIN_VERSION}/${plugin}"; \
    echo "${PLUGIN_SHA256}  /plugins/${plugin}" | sha256sum -c -; \
    chmod 0644 "/plugins/${plugin}"; \
    rabbitmq-plugins enable --offline rabbitmq_delayed_message_exchange

# A imagem base já define o usuário `rabbitmq`; o `USER root` acima era só para
# escrever em /plugins. Restaurado explicitamente para que uma edição futura
# neste arquivo não deixe o broker rodando como root sem ninguém notar.
USER rabbitmq
