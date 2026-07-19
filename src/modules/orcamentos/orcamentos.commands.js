import * as orcamentosService from './orcamentos.service.js';
import { formatarBRL } from '../../shared/formatters/currency.js';

// Emoji do nível de consumo do orçamento.
function emojiNivel(nivel) {
  if (nivel === 'estourado') return '🔴';
  if (nivel === 'aviso') return '⚠️';
  return '🟢';
}

// Linha de um orçamento no /orcamentos.
function linhaConsumo(c) {
  return `${emojiNivel(c.nivel)} ${c.categoria}: ${formatarBRL(c.gasto)} / ${formatarBRL(c.limite)} (${c.percentual}%)`;
}

// Registra os comandos do módulo Orçamentos no bot.
export function registrarOrcamentos(bot) {
  bot.command('addorcamento', (ctx) => ctx.scene.enter('add-orcamento'));
  bot.command('apagarorcamento', (ctx) => ctx.scene.enter('apagar-orcamento'));

  bot.command('orcamentos', async (ctx) => {
    try {
      const itens = await orcamentosService.listarComConsumo();
      if (itens.length === 0) {
        return ctx.reply('🎯 Nenhum orçamento cadastrado ainda. Use /addorcamento.');
      }
      await ctx.reply(`🎯 Orçamentos do mês\n\n${itens.map(linhaConsumo).join('\n')}`);
    } catch (err) {
      console.error('[orcamentos] Erro no /orcamentos:', err);
      await ctx.reply('⚠️ Não consegui listar os orçamentos agora.');
    }
  });
}
