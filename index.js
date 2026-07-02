import { configurarBot } from './src/app.js';
import { config } from './src/config/env.js';

const bot = configurarBot();

// Sobe o bot em webhook (produção) ou long polling (desenvolvimento).
async function iniciar() {
  if (config.isProduction && config.webhookDomain) {
    await bot.launch({
      webhook: {
        domain: config.webhookDomain,
        port: config.port,
      },
    });
    console.log(`🚀 FinanceBot no ar via WEBHOOK em ${config.webhookDomain}`);
  } else {
    // Sem await: em polling, launch() só resolve quando o bot é parado.
    bot.launch().catch((err) => {
      console.error('[BOOT] Falha no long polling:', err);
      process.exit(1);
    });
    console.log('🤖 FinanceBot no ar via LONG POLLING (modo desenvolvimento).');
  }
}

iniciar().catch((err) => {
  console.error('[BOOT] Falha ao iniciar o bot:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
