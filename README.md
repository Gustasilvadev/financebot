# 💰 FinanceBot

Bot de Telegram para **gestão completa de finanças pessoais**. Centraliza contas, gastos, empréstimos, orçamentos, assinaturas e metas de poupança — tudo no chat, de forma rápida e conversacional.

> Projeto pessoal · Versão 2.0

## ✨ Funcionalidades

### 🏦 Bancos
Gestão de saldos de contas independentes (ex.: Nubank, PicPay, carteira).

| Comando | Descrição |
|---|---|
| `/bancos` | Lista as contas e o saldo total consolidado |
| `/addbanco` | Cadastra uma nova conta (nome + saldo inicial) |
| `/atualizarsaldo` | Corrige o saldo de uma conta |
| `/apagarbanco` | Remove uma conta (com confirmação) |

### 💸 Fluxo de Caixa
Entradas e saídas com vencimento, categorias, vínculo com um banco e parcelamento.

| Comando | Descrição |
|---|---|
| `/gasto` | Registra uma despesa (com parcelamento opcional) |
| `/receita` | Registra uma entrada (com parcelamento opcional) |
| `/pagarconta` | Dá baixa nas pendências do mês (uma a uma ou todas) |
| `/editar` | Edita ou exclui um lançamento, reconciliando o saldo |
| `/mes` | Balanço do mês: receitas, despesas pagas/pendentes e saldo previsto |

### 🤝 Empréstimos
Controle de valores emprestados a terceiros, com débito/crédito automático no banco.

| Comando | Descrição |
|---|---|
| `/emprestar` | Registra um empréstimo e debita o valor do banco |
| `/emprestimos` | Lista quem te deve e o total a receber |
| `/quitaremprestimo` | Dá baixa e credita o valor acordado no banco |

### 📊 Gráficos
Visão visual do mês em imagem, direto no chat.

| Comando | Descrição |
|---|---|
| `/grafico` | Barras dos gastos do mês por categoria |
| `/lucro` | Ganhos do mês (receitas + lucro de empréstimos) |
| `/resultado` | Comparativo entradas × gastos |

### 🎯 Orçamentos
Limites de gasto por categoria, com alerta automático ao lançar despesas.

| Comando | Descrição |
|---|---|
| `/orcamentos` | Lista os limites e o consumo do mês (🟢 ok · ⚠️ perto · 🔴 estourado) |
| `/addorcamento` | Define o limite mensal de uma categoria |
| `/apagarorcamento` | Remove um orçamento |

### 🔁 Recorrentes / Assinaturas
Despesas e receitas fixas (streaming, aluguel, salário) que o bot lança sozinho todo mês, no dia certo.

| Comando | Descrição |
|---|---|
| `/recorrencias` | Lista as recorrências (ativas e pausadas) |
| `/addrecorrencia` | Cadastra uma recorrência |
| `/pausarrecorrencia` | Pausa ou retoma uma recorrência |
| `/apagarrecorrencia` | Remove uma recorrência |

### 🐷 Metas / Caixinhas
Caixinhas de poupança com objetivo. Guardar/resgatar move o dinheiro entre o banco e a caixinha.

| Comando | Descrição |
|---|---|
| `/metas` | Lista as caixinhas com barra de progresso |
| `/addmeta` | Cria uma caixinha (nome + objetivo) |
| `/guardar` | Reserva dinheiro de um banco numa caixinha |
| `/resgatar` | Devolve dinheiro de uma caixinha para um banco |
| `/apagarmeta` | Remove uma caixinha |
| `/patrimonio` | Total real: disponível nos bancos + guardado nas caixinhas |

### 🔔 Extras
- **Menu de comandos:** ao digitar `/`, a lista aparece com autocomplete; `/help` mostra o guia completo.
- **Rotina diária:** um cron externo dispara, uma vez por dia, a materialização das recorrências e o aviso dos vencimentos do dia (contas e empréstimos) — o mesmo mecanismo mantém o serviço ativo.
- Dentro de qualquer cadastro, `/cancelar` aborta a operação.

## 🛠️ Tecnologias

- **Node.js** (ESM)
- **Telegraf** — framework para bots do Telegram
- **Supabase** (PostgreSQL) — banco de dados
- **Render** — hospedagem, com um cron externo para keep-alive e a rotina diária

## 🏛️ Arquitetura

Organização modular por domínio (*feature-based*), com camadas bem definidas dentro de cada módulo.

```
src/
├── config/     # Configuração e conexão com serviços externos
├── core/       # Infra do bot (instância, menu, wizards, servidor HTTP, notificações)
├── modules/    # Um módulo por pilar de negócio
│   ├── bancos/
│   ├── fluxoCaixa/
│   ├── emprestimos/
│   ├── graficos/
│   ├── orcamentos/
│   ├── recorrencias/
│   └── metas/
│       ├── *.commands.js    # Handlers dos comandos
│       ├── *.scenes.js      # Fluxos conversacionais (wizards)
│       ├── *.service.js     # Regras de negócio
│       └── *.repository.js  # Acesso a dados
└── shared/     # Utilitários reutilizáveis (formatação, datas, gráficos, erros)
```

O fluxo de responsabilidade é sempre **comando → serviço → repositório**, e a comunicação entre módulos acontece apenas via *service*, mantendo as regras de negócio isoladas da interface e do banco.

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
3. Aplique o schema do banco (`db/schema.sql`) no SQL Editor do Supabase.
4. Inicie em modo de desenvolvimento:
   ```bash
   npm run dev
   ```
