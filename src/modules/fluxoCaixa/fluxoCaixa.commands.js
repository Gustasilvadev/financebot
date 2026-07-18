import * as fluxoService from './fluxoCaixa.service.js';
import { formatarBRL } from '../../shared/formatters/currency.js';

// Registra os comandos do módulo Fluxo de Caixa no bot.
export function registrarFluxoCaixa(bot) {
  bot.command('gasto', (ctx) => ctx.scene.enter('add-gasto'));
  bot.command('receita', (ctx) => ctx.scene.enter('add-receita'));
  bot.command('pagarconta', (ctx) => ctx.scene.enter('pagar-conta'));
  bot.command('editar', (ctx) => ctx.scene.enter('editar-lancamento'));

  // /mes — balanço do mês atual.
  bot.command('mes', async (ctx) => {
    try {
      const b = await fluxoService.balancoDoMes();
      if (b.vazio) {
        return ctx.reply(`Nenhuma movimentação registrada em ${b.rotulo}.`);
      }
      await ctx.reply(
        `📅 ${b.rotulo}\n\n` +
          `📈 Receitas: ${formatarBRL(b.receitas)}\n` +
          `📉 Despesas pagas: ${formatarBRL(b.despesasPagas)}\n` +
          `⏳ Despesas pendentes: ${formatarBRL(b.despesasPendentes)}\n` +
          `──────────────\n` +
          `💡 Saldo previsto: ${formatarBRL(b.saldoPrevisto)}`
      );
    } catch (err) {
      console.error('[fluxoCaixa] Erro no /mes:', err);
      await ctx.reply('⚠️ Não consegui gerar o balanço agora. Tente novamente.');
    }
  });
}
