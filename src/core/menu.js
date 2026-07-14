import { bot } from './bot.js';

// Comandos exibidos no menu do Telegram.
const COMANDOS = [
  { command: 'bancos', description: 'Listar contas e saldo total' },
  { command: 'addbanco', description: 'Cadastrar um banco' },
  { command: 'atualizarsaldo', description: 'Corrigir o saldo de um banco' },
  { command: 'apagarbanco', description: 'Remover um banco' },
  { command: 'gasto', description: 'Registrar uma despesa' },
  { command: 'receita', description: 'Registrar uma entrada' },
  { command: 'pagarconta', description: 'Dar baixa em contas pendentes' },
  { command: 'mes', description: 'Balanço do mês atual' },
  { command: 'emprestar', description: 'Registrar um empréstimo' },
  { command: 'emprestimos', description: 'Empréstimos a receber' },
  { command: 'quitaremprestimo', description: 'Dar baixa em um empréstimo' },
  { command: 'help', description: 'Ajuda e lista de comandos' },
];

// Texto do /help e do /start, agrupado por módulo.
export const TEXTO_AJUDA = [
  '🤖 FinanceBot — comandos',
  '',
  '🏦 Bancos',
  '• /bancos — contas e saldo total',
  '• /addbanco — cadastrar banco',
  '• /atualizarsaldo — corrigir saldo',
  '• /apagarbanco — remover banco',
  '',
  '💸 Fluxo de caixa',
  '• /gasto — registrar despesa',
  '• /receita — registrar entrada',
  '• /pagarconta — dar baixa em pendências',
  '• /mes — balanço do mês',
  '',
  '🤝 Empréstimos',
  '• /emprestar — registrar empréstimo',
  '• /emprestimos — a receber',
  '• /quitaremprestimo — dar baixa',
  '',
  'ℹ️ Dentro de um cadastro, /cancelar aborta.',
].join('\n');

// Registra o menu de comandos no Telegram.
export async function configurarMenuDeComandos() {
  await bot.telegram.setMyCommands(COMANDOS);
}
