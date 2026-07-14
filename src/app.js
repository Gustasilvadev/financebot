import { session } from 'telegraf';
import { bot } from './core/bot.js';
import { auth } from './core/middlewares/auth.js';
import { stage } from './core/stage.js';
import { registrarBancos } from './modules/bancos/bancos.commands.js';
import { registrarFluxoCaixa } from './modules/fluxoCaixa/fluxoCaixa.commands.js';
import { registrarEmprestimos } from './modules/emprestimos/emprestimos.commands.js';
import { TEXTO_AJUDA } from './core/menu.js';

// Monta o bot: middlewares, handlers base, módulos e tratamento global de erro.
export function configurarBot() {
  bot.use(auth);
  bot.use(session());
  bot.use(stage.middleware());

  bot.start((ctx) =>
    ctx.reply(`👋 Olá, ${ctx.from.first_name}! Seu FinanceBot está pronto.\n\nUse /help para ver todos os comandos.`)
  );
  bot.help((ctx) => ctx.reply(TEXTO_AJUDA));

  // Módulos de negócio (novos pilares entram aqui).
  registrarBancos(bot);
  registrarFluxoCaixa(bot);
  registrarEmprestimos(bot);

  // Captura erros não tratados dentro dos handlers.
  bot.catch((err, ctx) => {
    console.error(`[BOT] Erro ao processar update "${ctx.updateType}":`, err);
    ctx.reply('⚠️ Ops, algo deu errado ao processar sua solicitação.').catch(() => {});
  });

  return bot;
}
