import * as metasService from './metas.service.js';
import { formatarBRL } from '../../shared/formatters/currency.js';

// Barra de progresso textual (▰ cheio / ▱ vazio).
function barraProgresso(guardado, objetivo, tamanho = 10) {
  const frac = objetivo > 0 ? Math.min(guardado / objetivo, 1) : 0;
  const cheias = Math.round(frac * tamanho);
  return '▰'.repeat(cheias) + '▱'.repeat(tamanho - cheias);
}

// Bloco de uma meta no /metas.
function blocoMeta(m) {
  const guardado = Number(m.saldo_guardado);
  const objetivo = Number(m.valor_objetivo);
  const pct = objetivo > 0 ? Math.round((guardado / objetivo) * 100) : 0;
  const check = guardado >= objetivo ? ' ✅' : '';
  return `🐷 ${m.nome}${check}\n${barraProgresso(guardado, objetivo)} ${pct}%\n${formatarBRL(guardado)} / ${formatarBRL(objetivo)}`;
}

// Registra os comandos do módulo Metas no bot.
export function registrarMetas(bot) {
  bot.command('addmeta', (ctx) => ctx.scene.enter('add-meta'));
  bot.command('guardar', (ctx) => ctx.scene.enter('guardar'));
  bot.command('resgatar', (ctx) => ctx.scene.enter('resgatar'));
  bot.command('apagarmeta', (ctx) => ctx.scene.enter('apagar-meta'));

  bot.command('metas', async (ctx) => {
    try {
      const metas = await metasService.listar();
      if (metas.length === 0) {
        return ctx.reply('🐷 Nenhuma caixinha ainda. Use /addmeta.');
      }
      await ctx.reply(`🐷 Suas caixinhas\n\n${metas.map(blocoMeta).join('\n\n')}`);
    } catch (err) {
      console.error('[metas] Erro no /metas:', err);
      await ctx.reply('⚠️ Não consegui listar as caixinhas agora.');
    }
  });

  bot.command('patrimonio', async (ctx) => {
    try {
      const p = await metasService.patrimonio();
      await ctx.reply(
        `💰 Patrimônio\n\n` +
          `🏦 Disponível (bancos): ${formatarBRL(p.disponivel)}\n` +
          `🐷 Guardado (caixinhas): ${formatarBRL(p.guardado)}\n` +
          `──────────────\n` +
          `Σ Total: ${formatarBRL(p.total)}`
      );
    } catch (err) {
      console.error('[metas] Erro no /patrimonio:', err);
      await ctx.reply('⚠️ Não consegui calcular o patrimônio agora.');
    }
  });
}
