import { Scenes, Markup } from 'telegraf';
import * as fluxoService from '../fluxoCaixa.service.js';
import { formatarBRL } from '../../../shared/formatters/currency.js';
import { formatarData } from '../../../shared/formatters/date.js';
import { tentarCancelar } from '../../../shared/scenes/helpers.js';
import { paginar } from './ui.js';

// Cabeçalho da lista de pendentes (com o total).
function textoPendentes(contas, pagina) {
  const { p, totalPaginas } = paginar(contas, pagina);
  const total = contas.reduce((soma, c) => soma + Number(c.valor), 0);
  return `🧾 Pendentes do mês (${contas.length}) · Total ${formatarBRL(total)}\nPágina ${p + 1}/${totalPaginas} — toque para dar baixa:`;
}

// Teclado da página: botões de conta (só id no payload), navegação e concluir.
function tecladoPendentes(contas, pagina) {
  const { itens, p, totalPaginas } = paginar(contas, pagina);
  const linhas = itens.map((c) => {
    const emoji = c.tipo === 'DESPESA' ? '📉' : '📈';
    const label = `${emoji} ${formatarBRL(c.valor)} · ${c.descricao} (${formatarData(c.data_vencimento)})`;
    return [Markup.button.callback(label.slice(0, 60), `pay:${c.id}`)];
  });

  const nav = [];
  if (p > 0) nav.push(Markup.button.callback('◀️', `pag:${p - 1}`));
  if (p < totalPaginas - 1) nav.push(Markup.button.callback('▶️', `pag:${p + 1}`));
  if (nav.length) linhas.push(nav);

  linhas.push([Markup.button.callback('💸 Pagar todas', 'pagartodas')]);
  linhas.push([Markup.button.callback('✅ Concluir', 'fim')]);
  return Markup.inlineKeyboard(linhas);
}

// Atualiza a mensagem em vez de mandar uma nova (ignora "não modificada").
async function renderizar(ctx, contas, pagina) {
  try {
    await ctx.editMessageText(textoPendentes(contas, pagina), tecladoPendentes(contas, pagina));
  } catch {}
}

export const pagarContaScene = new Scenes.WizardScene(
  'pagar-conta',

  async (ctx) => {
    const contas = await fluxoService.listarPendentesDoMes();
    if (contas.length === 0) {
      await ctx.reply('🎉 Nenhuma conta pendente este mês.');
      return ctx.scene.leave();
    }
    ctx.wizard.state.contas = contas;
    ctx.wizard.state.pagina = 0;
    ctx.wizard.state.pagas = 0;
    await ctx.reply(textoPendentes(contas, 0), tecladoPendentes(contas, 0));
    return ctx.wizard.next();
  },

  // Trata os cliques: navegar, dar baixa ou concluir.
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;

    const data = ctx.callbackQuery?.data;
    if (!data) {
      await ctx.reply('👆 Use os botões (ou /cancelar).');
      return;
    }

    if (data === 'fim') {
      await ctx.answerCbQuery();
      const n = ctx.wizard.state.pagas;
      await ctx.editMessageText(n > 0 ? `Pronto! ${n} conta(s) quitada(s).` : 'Encerrado.');
      return ctx.scene.leave();
    }

    if (data === 'pagartodas') {
      await ctx.answerCbQuery();
      const contas = ctx.wizard.state.contas;
      const total = contas.reduce((soma, c) => soma + Number(c.valor), 0);
      const teclado = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Confirmar', 'confirmar-todas'), Markup.button.callback('❌ Cancelar', 'cancelar-todas')],
      ]);
      await ctx.editMessageText(`Pagar todas as ${contas.length} conta(s) (${formatarBRL(total)})?`, teclado);
      return;
    }

    if (data === 'cancelar-todas') {
      await ctx.answerCbQuery();
      return renderizar(ctx, ctx.wizard.state.contas, ctx.wizard.state.pagina);
    }

    if (data === 'confirmar-todas') {
      await ctx.answerCbQuery();
      let resultado;
      try {
        resultado = await fluxoService.pagarTodasDoMes();
      } catch (err) {
        console.error('[fluxoCaixa] Erro ao pagar todas:', err);
        await ctx.editMessageText('⚠️ Erro ao pagar as contas.');
        return ctx.scene.leave();
      }
      let msg = `✅ ${resultado.pagas} conta(s) quitada(s) (${formatarBRL(resultado.total)}).`;
      if (resultado.falhou) msg += '\n⚠️ Parei numa falha — rode /pagarconta de novo para o resto.';
      await ctx.editMessageText(msg);
      return ctx.scene.leave();
    }

    if (data.startsWith('pag:')) {
      await ctx.answerCbQuery();
      ctx.wizard.state.pagina = Number(data.slice(4));
      return renderizar(ctx, ctx.wizard.state.contas, ctx.wizard.state.pagina);
    }

    if (data.startsWith('pay:')) {
      try {
        const { jaEstavaPaga, saldoAjustado } = await fluxoService.pagarConta(Number(data.slice(4)));
        if (jaEstavaPaga) {
          await ctx.answerCbQuery('Já estava paga.');
        } else {
          ctx.wizard.state.pagas += 1;
          await ctx.answerCbQuery(saldoAjustado ? '✅ Pago!' : '✅ Pago (sem banco para debitar).');
        }
      } catch (err) {
        console.error('[fluxoCaixa] Erro ao pagar conta:', err);
        await ctx.answerCbQuery('⚠️ Erro ao pagar.');
        return;
      }

      const contas = await fluxoService.listarPendentesDoMes();
      if (contas.length === 0) {
        await ctx.editMessageText(`Pronto! ${ctx.wizard.state.pagas} conta(s) quitada(s). Nada mais pendente. 🎉`);
        return ctx.scene.leave();
      }
      ctx.wizard.state.contas = contas;
      return renderizar(ctx, contas, ctx.wizard.state.pagina);
    }

    await ctx.reply('👆 Use os botões (ou /cancelar).');
  }
);
