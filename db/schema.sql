-- Schema do FinanceBot (Supabase / PostgreSQL).
-- Aplicar no Supabase: SQL Editor -> colar -> Run.

create table if not exists bancos (
  id            serial primary key,
  nome          varchar(100) not null unique,
  saldo_atual   decimal(12, 2) default 0.00,
  atualizado_em timestamp with time zone default now()
);

create table if not exists recorrencias (
  id             serial primary key,
  descricao      varchar(255) not null,
  valor          decimal(12, 2) not null,
  tipo           varchar(15) check (tipo in ('RECEITA', 'DESPESA')),
  categoria      varchar(50) default 'Geral',
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  banco_id       int references bancos(id) on delete set null,
  ativo          boolean default true,
  criado_em      timestamp with time zone default now()
);

create table if not exists movimentacoes (
  id              serial primary key,
  descricao       varchar(255) not null,
  valor           decimal(12, 2) not null,
  tipo            varchar(15) check (tipo in ('RECEITA', 'DESPESA')),
  categoria       varchar(50) default 'Geral',
  status          varchar(15) check (status in ('PAGO', 'PENDENTE')),
  data_vencimento date not null,
  banco_id        int references bancos(id) on delete set null,
  recorrencia_id  int references recorrencias(id) on delete set null,
  criado_em       timestamp with time zone default now()
);

create table if not exists emprestimos (
  id                    serial primary key,
  devedor               varchar(100) not null,
  valor_emprestado      decimal(12, 2) not null,
  valor_acordado        decimal(12, 2) not null,
  data_emprestimo       date not null,
  data_vencimento_final date not null,
  data_quitacao         date,
  status                varchar(15) check (status in ('ATIVO', 'QUITADO')) default 'ATIVO',
  criado_em             timestamp with time zone default now(),
  observacoes           text
);

create table if not exists orcamentos (
  id           serial primary key,
  categoria    varchar(50) not null unique,
  valor_limite decimal(12, 2) not null,
  ativo        boolean default true,
  criado_em    timestamp with time zone default now()
);

create table if not exists metas (
  id             serial primary key,
  nome           varchar(100) not null unique,
  valor_objetivo decimal(12, 2) not null,
  saldo_guardado decimal(12, 2) default 0.00,
  criado_em      timestamp with time zone default now()
);

create table if not exists meta_transacoes (
  id        serial primary key,
  meta_id   int references metas(id) on delete cascade,
  banco_id  int references bancos(id) on delete set null,
  tipo      varchar(15) check (tipo in ('GUARDAR', 'RESGATAR')),
  valor     decimal(12, 2) not null,
  criado_em timestamp with time zone default now()
);
