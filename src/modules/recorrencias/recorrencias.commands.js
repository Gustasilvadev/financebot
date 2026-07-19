import * as recorrenciasService from './recorrencias.service.js';
import { formatarBRL } from '../../shared/formatters/currency.js';

// Linha de uma recorrência no /recorrencias.
function linhaRecorrencia(r) {
  const status = r.ativo ? '✅' : '💤';
  const emoji = r.tipo === 'DESPESA' ? '📉' : '📈';
  return `${status} ${emoji} ${r.descricao} — ${formatarBRL(r.valor)} · todo dia ${r.dia_vencimento} · ${r.categoria}`;
}

// Registra os comandos do módulo Recorrências no bot.
export function registrarRecorrencias(bot) {
  bot.command('addrecorrencia', (ctx) => ctx.scene.enter('add-recorrencia'));
  bot.command('pausarrecorrencia', (ctx) => ctx.scene.enter('pausar-recorrencia'));
  bot.command('apagarrecorrencia', (ctx) => ctx.scene.enter('apagar-recorrencia'));

  bot.command('recorrencias', async (ctx) => {
    try {
      const lista = await recorrenciasService.listar();
      if (lista.length === 0) {
        return ctx.reply('🔁 Nenhuma recorrência cadastrada. Use /addrecorrencia.');
      }
      await ctx.reply(`🔁 Recorrências\n\n${lista.map(linhaRecorrencia).join('\n')}`);
    } catch (err) {
      console.error('[recorrencias] Erro no /recorrencias:', err);
      await ctx.reply('⚠️ Não consegui listar as recorrências agora.');
    }
  });
}
