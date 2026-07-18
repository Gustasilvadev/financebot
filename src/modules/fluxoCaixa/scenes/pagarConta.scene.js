import { Scenes, Markup } from 'telegraf';
import * as fluxoService from '../fluxoCaixa.service.js';
import { formatarBRL } from '../../../shared/formatters/currency.js';
import { formatarData } from '../../../shared/formatters/date.js';
import { tentarCancelar } from '../../../shared/scenes/helpers.js';
import { paginar } from './ui.js';

// Cabeçalho da lista de pendentes.
function textoPendentes(contas, pagina) {
  const { p, totalPaginas } = paginar(contas, pagina);
  return `🧾 Pendentes do mês (${contas.length}) — página ${p + 1}/${totalPaginas}\nToque para dar baixa:`;
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

  linhas.push([Markup.button.callback('✅ Concluir', 'fim')]);
  return Markup.inlineKeyboard(linhas);
}

// Atualiza a mensagem em vez de mandar uma nova (ignora "não modificada").
async function renderizar(ctx, contas, pagina) {
  try {
    await ctx.editMessageText(textoPendentes(contas, pagina), tecladoPendentes(contas, pagina));
  } catch {
    // Erros benignos do Telegram (ex.: mensagem não modificada) são ignorados.
  }
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

      // Re-consulta (a conta paga sai da lista) e re-renderiza.
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
