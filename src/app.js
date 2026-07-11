import { session } from 'telegraf';
import { bot } from './core/bot.js';
import { auth } from './core/middlewares/auth.js';
import { stage } from './core/stage.js';
import { registrarBancos } from './modules/bancos/bancos.commands.js';
import { registrarFluxoCaixa } from './modules/fluxoCaixa/fluxoCaixa.commands.js';

// Monta o bot: middlewares, handlers base, módulos e tratamento global de erro.
export function configurarBot() {
  bot.use(auth);
  bot.use(session());
  bot.use(stage.middleware());

  bot.start((ctx) =>
    ctx.reply(
      `👋 Olá, ${ctx.from.first_name}! Seu FinanceBot está no ar.\n\n` +
        `Os módulos (Bancos, Fluxo de Caixa e Empréstimos) serão adicionados em breve.`
    )
  );
  bot.help((ctx) => ctx.reply('ℹ️ Comandos em construção. Volte já já!'));

  // Módulos de negócio (novos pilares entram aqui).
  registrarBancos(bot);
  registrarFluxoCaixa(bot);

  // Captura erros não tratados dentro dos handlers.
  bot.catch((err, ctx) => {
    console.error(`[BOT] Erro ao processar update "${ctx.updateType}":`, err);
    ctx.reply('⚠️ Ops, algo deu errado ao processar sua solicitação.').catch(() => {});
  });

  return bot;
}
