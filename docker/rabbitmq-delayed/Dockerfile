FROM rabbitmq:3.12-management-alpine

ADD https://github.com/rabbitmq/rabbitmq-delayed-message-exchange/releases/download/v3.12.0/rabbitmq_delayed_message_exchange-3.12.0.ez /plugins/rabbitmq_delayed_message_exchange-3.12.0.ez

RUN chmod 0644 /plugins/rabbitmq_delayed_message_exchange-3.12.0.ez && \
    rabbitmq-plugins enable --offline rabbitmq_delayed_message_exchange
