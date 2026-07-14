import { configurarBot } from './src/app.js';
import { config } from './src/config/env.js';
import { iniciarServidorHttp } from './src/core/httpServer.js';
import { configurarMenuDeComandos } from './src/core/menu.js';

const bot = configurarBot();

// Sobe o bot em webhook (produção) ou long polling (desenvolvimento).
async function iniciar() {
  // Registra o menu de comandos do Telegram.
  configurarMenuDeComandos().catch((err) => console.error('[menu] Falha ao registrar comandos:', err));

  if (config.isProduction && config.webhookDomain) {
    await bot.launch({
      webhook: {
        domain: config.webhookDomain,
        port: config.port,
      },
    });
    console.log(`🚀 FinanceBot no ar via WEBHOOK em ${config.webhookDomain}`);
  } else {
    bot.launch().catch((err) => {
      console.error('[BOOT] Falha no long polling:', err);
      process.exit(1);
    });
    // Servidor HTTP na PORT: o keep-alive/cron mantém Render e Supabase.
    iniciarServidorHttp();
    console.log('🤖 FinanceBot no ar via LONG POLLING + servidor keep-alive.');
  }
}

iniciar().catch((err) => {
  console.error('[BOOT] Falha ao iniciar o bot:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
