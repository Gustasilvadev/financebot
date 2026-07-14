import * as emprestimosService from './emprestimos.service.js';
import { formatarBRL } from '../../shared/formatters/currency.js';
import { formatarData } from '../../shared/formatters/date.js';

// Registra os comandos do módulo Empréstimos no bot.
export function registrarEmprestimos(bot) {
  bot.command('emprestar', (ctx) => ctx.scene.enter('emprestar'));
  bot.command('quitaremprestimo', (ctx) => ctx.scene.enter('quitar-emprestimo'));

  // /emprestimos — lista os ativos e o total a receber.
  bot.command('emprestimos', async (ctx) => {
    try {
      const { emprestimos, totalAReceber } = await emprestimosService.listarAtivosComTotal();
      if (emprestimos.length === 0) {
        return ctx.reply('Você não tem empréstimos ativos.');
      }
      const linhas = emprestimos
        .map((e) => `• ${e.devedor} — ${formatarBRL(e.valor_acordado)} (venc. ${formatarData(e.data_vencimento_final)})`)
        .join('\n');
      await ctx.reply(
        `🤝 Empréstimos a receber\n\n${linhas}\n──────────────\n💰 Total a receber: ${formatarBRL(totalAReceber)}`
      );
    } catch (err) {
      console.error('[emprestimos] Erro no /emprestimos:', err);
      await ctx.reply('⚠️ Não consegui buscar seus empréstimos agora. Tente novamente.');
    }
  });
}
