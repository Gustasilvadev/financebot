import * as bancosService from './bancos.service.js';
import * as metasService from '../metas/metas.service.js';
import { formatarBRL } from '../../shared/formatters/currency.js';

// Registra os comandos do módulo Bancos no bot.
export function registrarBancos(bot) {
  // /bancos — cada banco com disponível e guardado em caixinhas, mais o total.
  bot.command('bancos', async (ctx) => {
    try {
      const { bancos } = await bancosService.listarComTotal();
      if (bancos.length === 0) {
        return ctx.reply('Você ainda não tem bancos cadastrados. Use /addbanco para começar.');
      }
      const guardadoPorBanco = await metasService.saldoGuardadoPorBanco();

      let totalDisponivel = 0;
      let totalGuardado = 0;
      const blocos = bancos.map((b) => {
        const disponivel = Number(b.saldo_atual);
        const guardado = guardadoPorBanco.get(b.id) ?? 0;
        totalDisponivel += disponivel;
        totalGuardado += guardado;
        const extra = guardado > 0 ? `\n   🐷 nas caixinhas: ${formatarBRL(guardado)}` : '';
        return `• ${b.nome}: ${formatarBRL(disponivel)}${extra}`;
      });

      const total = Math.round((totalDisponivel + totalGuardado) * 100) / 100;
      await ctx.reply(
        `💳 Seus bancos\n\n${blocos.join('\n')}\n──────────────\n` +
          `💰 Disponível: ${formatarBRL(totalDisponivel)}\n` +
          `🐷 Nas caixinhas: ${formatarBRL(totalGuardado)}\n` +
          `Σ Total: ${formatarBRL(total)}`
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
