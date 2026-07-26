# 💰 FinanceBot

Bot de Telegram para **gestão completa de finanças pessoais**. Centraliza contas, gastos, empréstimos, orçamentos, assinaturas e caixinhas de poupança — tudo no chat, de forma rápida e conversacional.

> Projeto pessoal · Versão 2.0

## ✨ Funcionalidades

### 🏦 Bancos
Gestão de saldos de contas independentes (ex.: Nubank, PicPay, carteira).

| Comando | Descrição |
|---|---|
| `/bancos` | Lista as contas com o **disponível** e o **guardado em caixinhas**, mais o total |
| `/novo_banco` | Cadastra uma nova conta (nome + saldo inicial) |
| `/atualizar_saldo` | Corrige o saldo de uma conta |
| `/apagar_banco` | Remove uma conta (com confirmação) |

### 💸 Fluxo de Caixa
Entradas e saídas com vencimento, categorias, vínculo com um banco e parcelamento.

| Comando | Descrição |
|---|---|
| `/gasto` | Registra uma despesa (com parcelamento opcional) |
| `/receita` | Registra uma entrada (com parcelamento opcional) |
| `/pagar_conta` | Dá baixa nas pendências do mês (uma a uma ou todas) |
| `/editar` | Edita ou exclui um lançamento, reconciliando o saldo |
| `/mes` | Balanço do mês: receitas, despesas pagas/pendentes e saldo previsto |

### 🤝 Empréstimos
Controle de valores emprestados a terceiros, com débito/crédito automático no banco.

| Comando | Descrição |
|---|---|
| `/novo_emprestimo` | Registra um empréstimo **à vista ou parcelado** (recebe em N vezes) e debita o valor do banco |
| `/emprestimos` | Lista quem te deve e o total a receber |
| `/quitar_emprestimo` | Dá baixa (parcela a parcela) e credita o valor no banco |

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
| `/novo_orcamento` | Define o limite mensal de uma categoria |
| `/apagar_orcamento` | Remove um orçamento |

### 🔁 Recorrentes / Assinaturas
Despesas e receitas fixas (streaming, aluguel, salário) que o bot lança sozinho todo mês, no dia certo.

| Comando | Descrição |
|---|---|
| `/recorrencias` | Lista as recorrências (ativas e pausadas) |
| `/nova_recorrencia` | Cadastra uma recorrência |
| `/pausar_recorrencia` | Pausa ou retoma uma recorrência |
| `/apagar_recorrencia` | Remove uma recorrência |

### 🐷 Caixinhas
Caixinhas de poupança com objetivo, **vinculadas a um banco**. Guardar/resgatar move o dinheiro entre o banco e a caixinha.

| Comando | Descrição |
|---|---|
| `/caixinhas` | Lista as caixinhas com barra de progresso |
| `/nova_caixinha` | Cria uma caixinha de um banco (nome + objetivo) |
| `/guardar` | Reserva dinheiro do banco na caixinha |
| `/resgatar` | Devolve dinheiro da caixinha para o banco |
| `/atualizar_caixinha` | Registra o **rendimento** (reconcilia com o saldo do app do banco) |
| `/apagar_caixinha` | Remove uma caixinha |
| `/patrimonio` | Total real: disponível nos bancos + guardado nas caixinhas |

### 🔔 Extras
- **Menu de comandos:** ao digitar `/`, a lista aparece com autocomplete; `/help` mostra o guia completo.
- **Rotina diária (cron):** uma vez por dia o bot materializa as recorrências, avisa os vencimentos (contas e empréstimos) e, no **dia 1º do mês**, lembra de atualizar os rendimentos das caixinhas. O mesmo mecanismo mantém o serviço ativo.
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
