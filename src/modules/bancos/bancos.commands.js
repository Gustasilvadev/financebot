import * as bancosService from './bancos.service.js';
import { formatarBRL } from '../../shared/formatters/currency.js';

// Registra os comandos do módulo Bancos no bot.
export function registrarBancos(bot) {
  // /bancos — lista os bancos e o total consolidado.
  bot.command('bancos', async (ctx) => {
    try {
      const { bancos, total } = await bancosService.listarComTotal();

      if (bancos.length === 0) {
        return ctx.reply('Você ainda não tem bancos cadastrados. Use /addbanco para começar.');
      }

      const linhas = bancos.map((b) => `• ${b.nome}: ${formatarBRL(b.saldo_atual)}`).join('\n');
      await ctx.reply(
        `💳 Seus bancos\n\n${linhas}\n──────────────\n💰 Total: ${formatarBRL(total)}`
      );
    } catch (err) {
      console.error('[bancos] Erro no /bancos:', err);
      await ctx.reply('⚠️ Não consegui buscar seus bancos agora. Tente novamente.');
    }
  });

  bot.command('addbanco', (ctx) => ctx.scene.enter('add-banco'));
  bot.command('atualizarsaldo', (ctx) => ctx.scene.enter('atualizar-saldo'));
  bot.command('apagarbanco', (ctx) => ctx.scene.enter('apagar-banco'));
}
