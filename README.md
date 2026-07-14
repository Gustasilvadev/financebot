# 💰 FinanceBot

Bot de Telegram para **gestão de finanças pessoais**. Centraliza o controle de contas, gastos e valores a receber diretamente no chat, de forma rápida e conversacional.

> Projeto pessoal.

## ✨ Funcionalidades

Os três pilares — **Bancos**, **Fluxo de Caixa** e **Empréstimos** — estão disponíveis.

### 🏦 Bancos
Gestão de saldos de contas independentes (ex.: Nubank, PicPay, carteira).

| Comando | Descrição |
|---|---|
| `/bancos` | Lista todas as contas e mostra o saldo total consolidado |
| `/addbanco` | Cadastra uma nova conta (nome + saldo inicial) |
| `/atualizarsaldo` | Corrige o saldo de uma conta |
| `/apagarbanco` | Remove uma conta (com confirmação) |

### 💸 Fluxo de Caixa
Registro de entradas e saídas com data de vencimento, categorias, vínculo com um banco e parcelamento.

| Comando | Descrição |
|---|---|
| `/gasto` | Registra uma despesa (com parcelamento opcional) |
| `/receita` | Registra uma entrada (com parcelamento opcional) |
| `/pagarconta` | Lista as pendências do mês para dar baixa |
| `/mes` | Balanço do mês: receitas, despesas pagas/pendentes e saldo previsto |

### 🤝 Empréstimos
Controle de valores emprestados a terceiros, com débito/crédito automático no banco.

| Comando | Descrição |
|---|---|
| `/emprestar` | Registra um empréstimo e debita o valor do banco |
| `/emprestimos` | Lista quem te deve e o total a receber |
| `/quitaremprestimo` | Dá baixa e credita o valor acordado no banco |

### 🔔 Extras
- **Menu de comandos:** ao digitar `/` no Telegram, a lista de comandos aparece com autocomplete. `/help` mostra o guia completo.
- **Notificações diárias:** um aviso proativo com os vencimentos do dia (contas e empréstimos), disparado por um cron externo que também mantém o serviço ativo.
- Dentro de qualquer cadastro, `/cancelar` aborta a operação.

## 🛠️ Tecnologias

- **Node.js** (ESM)
- **Telegraf** — framework para bots do Telegram
- **Supabase** (PostgreSQL) — banco de dados

## 🏛️ Arquitetura

Organização modular por domínio (*feature-based*), com camadas bem definidas dentro de cada módulo:

```
src/
├── config/     # Configuração e conexão com serviços externos
├── core/       # Infraestrutura do bot (instância, middlewares, wizards, servidor HTTP)
├── modules/    # Cada pilar de negócio (bancos, fluxoCaixa, emprestimos)
│   └── bancos/
│       ├── *.commands.js    # Handlers dos comandos
│       ├── *.scenes.js      # Fluxos conversacionais (wizards)
│       ├── *.service.js     # Regras de negócio
│       └── *.repository.js  # Acesso a dados
└── shared/     # Utilitários reutilizáveis (formatação, datas, erros)
```

O fluxo de responsabilidade é sempre **comando → serviço → repositório**, mantendo as regras de negócio isoladas da interface e do banco de dados.

## 🚀 Como executar

### Pré-requisitos
- Node.js 18 ou superior
- Um bot criado no Telegram (via [@BotFather](https://t.me/BotFather))
- Um projeto no [Supabase](https://supabase.com)

### Passos
1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie o arquivo `.env` a partir do modelo e preencha com suas credenciais:
   ```bash
   cp .env.example .env
   ```
3. Inicie em modo de desenvolvimento:
   ```bash
   npm run dev
   ```
