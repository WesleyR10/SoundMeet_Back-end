# Scheduling Module

O módulo **Scheduling** é o núcleo responsável pelo gerenciamento de tempo, reservas e disponibilidade dentro da plataforma SoundMeet. Ele implementa uma lógica robusta de calendário para músicos, bandas e estabelecimentos, permitindo agendamentos precisos e evitando conflitos.

Este módulo segue os princípios da **Clean Architecture** e **Domain-Driven Design (DDD)**, garantindo desacoplamento e testabilidade.

---

## 🏗 Arquitetura

O módulo está organizado nas camadas padrão do projeto:

- **Domain**: Contém as regras de negócio puras, entidades e agregados.
- **Application**: Casos de uso (Use Cases) que orquestram o fluxo de dados.
- **Infra**: Implementações de repositórios (In-Memory, Prisma) e modelos de leitura.

---

## 🧩 Modelo de Domínio

### 1. Availability (Disponibilidade)
Define **quando** um recurso (Músico ou Banda) pode ser agendado.
- **Weekly Rules**: Regras recorrentes (ex: "Toda sexta-feira das 18h às 22h").
- **Unavailabilities**: Bloqueios específicos de data/hora (ex: "Férias de 01/01 a 15/01").
- **Configurações**:
  - `timezone`: Suporte a fusos horários.
  - `default_buffer_minutes`: Tempo de preparação/intervalo entre shows.
  - `max_shows_per_day`: Limite diário de agendamentos.

### 2. Inquiry (Consulta/Negociação)
Representa o início de uma negociação antes de um agendamento ser confirmado.
- Permite que estabelecimentos e músicos negociem termos sem bloquear a agenda imediatamente.
- **Estados**: `OPEN` → `ACCEPTED` / `REJECTED` → `CONVERTED`.
- Pode ser convertido em um `Booking` oficial.

### 3. Booking (Agendamento)
Representa uma reserva confirmada ou em processo de confirmação.
- Vincula um **Estabelecimento** a um **Músico** ou **Banda** para um **Evento** específico.
- **Estados**: `PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`.
- **Funcionalidades**:
  - `buffer_minutes`: Respeita o buffer configurado na disponibilidade.
  - `fee`: Valor acordado para o show.
  - `cancellation_policy`: Regras de cancelamento gratuito.

---

## 🚀 Funcionalidades Principais

### Gestão de Disponibilidade (Free/Busy)
O sistema calcula automaticamente os intervalos ocupados (`busy`) com base em:
1. **Agendamentos Confirmados** (`Booking`).
2. **Bloqueios Manuais** (`Unavailability`).
3. **Regras de Recorrência** (Inverso das `Weekly Rules`).
4. **Buffers**: Adiciona automaticamente tempo extra antes e depois dos eventos.

### Fluxo de Agendamento
1. **Proposta**: Um `Inquiry` é criado ou um `Booking` é proposto diretamente (`ProposeBooking`).
2. **Verificação**: O sistema checa conflitos de horário usando o `CalendarReadModel`.
3. **Confirmação**: Ao confirmar, o horário é bloqueado definitivamente.

### Integração
O módulo se conecta com outros domínios através de identificadores (IDs):
- `musician_id` / `band_id` (Core/Musician)
- `establishment_id` (Core/Establishment)
- `event_id` (Core/Establishment)

---

## 🛠 Casos de Uso (Use Cases)

| Use Case | Descrição |
|----------|-----------|
| **GetFreeBusy** | Retorna intervalos ocupados e livres para um período, considerando todas as regras. |
| **SetAvailability** | Configura regras de disponibilidade, horário de trabalho e exceções. |
| **ProposeBooking** | Cria uma intenção de agendamento (Booking pendente). |
| **ConvertInquiryToBooking** | Transforma uma negociação bem-sucedida em um agendamento real. |
| **CreateBooking** | Criação direta de agendamentos (geralmente administrativo ou migração). |

---

## 📦 Estrutura de Pastas

```
src/core/scheduling/
├── application/
│   ├── gateways/       # Interfaces para Read Models (ex: ICalendarReadModel)
│   └── use-cases/      # Implementação dos fluxos de negócio
├── domain/
│   ├── availability/   # Agregado de Disponibilidade
│   ├── booking/        # Agregado de Agendamento
│   ├── inquiry/        # Agregado de Consulta
│   └── events/         # Eventos de domínio (BookingConfirmed, etc.)
└── infra/
    ├── db/             # Implementações de Repositórios (Prisma, In-Memory)
    └── http/           # Controllers e DTOs (se aplicável)
```

## 📝 Exemplo de Uso (Conceitual)

Para verificar a disponibilidade de um músico:

```typescript
const output = await getFreeBusyUseCase.execute({
  target_type: 'musician',
  target_id: 'musician-uuid',
  start_at: new Date('2023-10-01T00:00:00Z'),
  end_at: new Date('2023-10-07T23:59:59Z')
});

// O output conterá os intervalos onde o músico NÃO pode ser agendado.
```
