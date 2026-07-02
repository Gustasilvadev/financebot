# 💰 FinanceBot

Bot de Telegram para **gestão de finanças pessoais**. Centraliza o controle de contas, gastos e valores a receber diretamente no chat, de forma rápida e conversacional.

> Projeto pessoal e privado: o bot responde apenas ao seu proprietário.

## ✨ Funcionalidades

O projeto é organizado em três pilares. O módulo de **Bancos** já está disponível; os demais estão em desenvolvimento.

### 🏦 Bancos (disponível)
Gestão de saldos de contas independentes (ex.: Nubank, PicPay, carteira).

| Comando | Descrição |
|---|---|
| `/bancos` | Lista todas as contas e mostra o saldo total consolidado |
| `/addbanco` | Cadastra uma nova conta (nome + saldo inicial) |
| `/atualizarsaldo` | Corrige o saldo de uma conta |
| `/apagarbanco` | Remove uma conta (com confirmação) |
| `/cancelar` | Cancela a operação em andamento |

Comandos gerais: `/start` e `/help`.

### 💸 Fluxo de Caixa (em breve)
Registro de entradas e saídas com datas de vencimento e suporte a parcelamentos.

### 🤝 Empréstimos (em breve)
Controle de valores emprestados a terceiros e seus acordos.

## 🛠️ Tecnologias

- **Node.js** (ESM)
- **Telegraf** — framework para bots do Telegram
- **Supabase** (PostgreSQL) — banco de dados
- **dotenv** — configuração por ambiente

## 🏛️ Arquitetura

Organização modular por domínio (*feature-based*), com camadas bem definidas dentro de cada módulo:

```
src/
├── config/     # Configuração e conexão com serviços externos
├── core/       # Infraestrutura do bot (instância, middlewares, wizards)
├── modules/    # Cada pilar de negócio (bancos, ...)
│   └── bancos/
│       ├── *.commands.js    # Handlers dos comandos
│       ├── *.scenes.js      # Fluxos conversacionais (wizards)
│       ├── *.service.js     # Regras de negócio
│       └── *.repository.js  # Acesso a dados
└── shared/     # Utilitários reutilizáveis (formatação, erros)
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

As credenciais e tokens são fornecidos exclusivamente por variáveis de ambiente e **nunca** são versionados.

## 📄 Licença

MIT
