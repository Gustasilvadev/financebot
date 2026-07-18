import { Scenes, Markup } from 'telegraf';
import * as fluxoService from '../fluxoCaixa.service.js';
import { parseValorBRL, formatarBRL } from '../../../shared/formatters/currency.js';
import { parseData, formatarData } from '../../../shared/formatters/date.js';
import { tentarCancelar, responderErro } from '../../../shared/scenes/helpers.js';
import { pedirConfirmacao, criarPassoConfirmacao } from '../../../shared/scenes/confirmacao.js';
import { CATEGORIAS, tecladoCategorias, tecladoStatus, paginar } from './ui.js';

const ROTULOS_CAMPO = {
  descricao: 'Descrição',
  valor: 'Valor',
  categoria: 'Categoria',
  data_vencimento: 'Vencimento',
  status: 'Status',
};

// Formata o valor atual de um campo da movimentação.
function formatarCampoAtual(mov, campo) {
  if (campo === 'valor') return formatarBRL(mov.valor);
  if (campo === 'data_vencimento') return formatarData(mov.data_vencimento);
  return String(mov[campo]);
}

// Formata o novo valor informado de um campo.
function formatarCampoNovo(campo, valorRaw) {
  if (campo === 'valor') return formatarBRL(parseValorBRL(valorRaw));
  if (campo === 'data_vencimento') return formatarData(parseData(valorRaw));
  return String(valorRaw);
}

// Resumo de confirmação de uma edição.
function montarResumoEdicao(mov, campo, valorRaw) {
  return (
    `✏️ Editar "${mov.descricao}"\n` +
    `${ROTULOS_CAMPO[campo]}: ${formatarCampoAtual(mov, campo)} → ${formatarCampoNovo(campo, valorRaw)}`
  );
}

// Resumo de confirmação de uma exclusão.
function montarResumoExclusao(mov) {
  const extra = mov.status === 'PAGO' ? ' e vai estornar o saldo.' : '.';
  return `🗑️ Excluir "${mov.descricao}" (${formatarBRL(mov.valor)}, ${mov.status})?\nEsta ação é irreversível${extra}`;
}

// Mensagem de resultado de uma edição.
function montarRespostaEdicao(r) {
  let msg = `✅ Lançamento atualizado (${ROTULOS_CAMPO[r.campo]}).`;
  if (r.semBanco) msg += ' ⚠️ Banco removido — saldo não ajustado.';
  else if (r.saldoAjustado) msg += ` Saldo ajustado em ${formatarBRL(r.delta)}.`;
  return msg;
}

// Mensagem de resultado de uma exclusão.
function montarRespostaExclusao(r) {
  let msg = `🗑️ Lançamento "${r.mov.descricao}" excluído.`;
  if (r.semBanco) msg += ' ⚠️ Banco removido — saldo não ajustado.';
  else if (r.saldoAjustado) msg += ` Saldo estornado em ${formatarBRL(r.estorno)}.`;
  return msg;
}

// Cabeçalho da lista de lançamentos do mês.
function textoLancamentos(movs, pagina) {
  const { p, totalPaginas } = paginar(movs, pagina);
  return `✏️ Lançamentos do mês (${movs.length}) — página ${p + 1}/${totalPaginas}\nEscolha um para editar ou excluir:`;
}

// Teclado paginado dos lançamentos do mês.
function tecladoLancamentos(movs, pagina) {
  const { itens, p, totalPaginas } = paginar(movs, pagina);
  const linhas = itens.map((m) => {
    const emoji = m.tipo === 'DESPESA' ? '📉' : '📈';
    const flag = m.status === 'PAGO' ? '✅' : '⏳';
    const label = `${emoji}${flag} ${formatarBRL(m.valor)} · ${m.descricao}`;
    return [Markup.button.callback(label.slice(0, 60), `edit:${m.id}`)];
  });
  const nav = [];
  if (p > 0) nav.push(Markup.button.callback('◀️', `pag:${p - 1}`));
  if (p < totalPaginas - 1) nav.push(Markup.button.callback('▶️', `pag:${p + 1}`));
  if (nav.length) linhas.push(nav);
  return Markup.inlineKeyboard(linhas);
}

// Menu de campos editáveis + excluir.
function tecladoMenuCampos() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Descrição', 'campo:descricao'), Markup.button.callback('Valor', 'campo:valor')],
    [Markup.button.callback('Categoria', 'campo:categoria'), Markup.button.callback('Vencimento', 'campo:data_vencimento')],
    [Markup.button.callback('Status', 'campo:status')],
    [Markup.button.callback('🗑️ Excluir', 'campo:excluir')],
  ]);
}

// Teclado de confirmação (mesmos callbacks do M4).
function tecladoConfirmar() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Confirmar', 'confirmar'), Markup.button.callback('❌ Cancelar', 'cancelar')],
  ]);
}

export const editarLancamentoScene = new Scenes.WizardScene(
  'editar-lancamento',

  // Lista os lançamentos do mês.
  async (ctx) => {
    const movs = await fluxoService.listarDoMes();
    if (movs.length === 0) {
      await ctx.reply('Nenhuma movimentação neste mês.');
      return ctx.scene.leave();
    }
    ctx.wizard.state.movs = movs;
    ctx.wizard.state.pagina = 0;
    await ctx.reply(textoLancamentos(movs, 0), tecladoLancamentos(movs, 0));
    return ctx.wizard.next();
  },

  // Recebe a seleção (ou navega) e mostra o menu de campos.
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;
    const data = ctx.callbackQuery?.data;
    if (!data) {
      await ctx.reply('👆 Use os botões (ou /cancelar).');
      return;
    }

    if (data.startsWith('pag:')) {
      await ctx.answerCbQuery();
      ctx.wizard.state.pagina = Number(data.slice(4));
      try {
        await ctx.editMessageText(
          textoLancamentos(ctx.wizard.state.movs, ctx.wizard.state.pagina),
          tecladoLancamentos(ctx.wizard.state.movs, ctx.wizard.state.pagina)
        );
      } catch {
        // ignora "mensagem não modificada"
      }
      return;
    }

    if (data.startsWith('edit:')) {
      await ctx.answerCbQuery();
      const id = Number(data.slice(5));
      const mov = ctx.wizard.state.movs.find((m) => m.id === id);
      if (!mov) {
        await ctx.reply('⚠️ Não encontrado. Recomece com /editar.');
        return ctx.scene.leave();
      }
      ctx.wizard.state.movId = id;
      ctx.wizard.state.mov = mov;
      await ctx.reply(
        `Editando "${mov.descricao}" (${formatarBRL(mov.valor)}, ${mov.status}).\nO que deseja mudar?`,
        tecladoMenuCampos()
      );
      return ctx.wizard.next();
    }

    await ctx.reply('👆 Use os botões (ou /cancelar).');
  },

  // Recebe o campo escolhido; pede o novo valor (ou confirma a exclusão).
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;
    const data = ctx.callbackQuery?.data;
    if (!data || !data.startsWith('campo:')) {
      await ctx.reply('👆 Escolha uma opção nos botões (ou /cancelar).');
      return;
    }
    await ctx.answerCbQuery();

    const campo = data.slice(6);
    ctx.wizard.state.campo = campo;
    const mov = ctx.wizard.state.mov;

    if (campo === 'excluir') {
      await ctx.reply(`${montarResumoExclusao(mov)}\n\nConfirmar?`, tecladoConfirmar());
      return ctx.wizard.selectStep(4);
    }

    if (campo === 'categoria') {
      await ctx.reply('🏷️ Nova categoria:', tecladoCategorias(CATEGORIAS[mov.tipo]));
    } else if (campo === 'status') {
      await ctx.reply('Novo status:', tecladoStatus());
    } else if (campo === 'data_vencimento') {
      await ctx.reply('📅 Nova data ("hoje" ou DD/MM):');
    } else if (campo === 'valor') {
      await ctx.reply('💵 Novo valor:');
    } else {
      await ctx.reply('📝 Nova descrição:');
    }
    return ctx.wizard.next();
  },

  // Recebe o novo valor do campo e pede confirmação.
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;
    const st = ctx.wizard.state;
    const campo = st.campo;
    let valorRaw;

    if (campo === 'categoria') {
      if (st.esperaCategoriaTexto) {
        valorRaw = ctx.message?.text?.trim();
        if (!valorRaw) {
          await ctx.reply('❌ Envie a categoria em texto.');
          return;
        }
      } else {
        const data = ctx.callbackQuery?.data;
        if (!data || !data.startsWith('cat:')) {
          await ctx.reply('👆 Escolha uma categoria nos botões.');
          return;
        }
        await ctx.answerCbQuery();
        const escolhida = CATEGORIAS[st.mov.tipo][Number(data.slice(4))];
        if (escolhida === 'Outra') {
          st.esperaCategoriaTexto = true;
          await ctx.reply('✏️ Digite a categoria:');
          return;
        }
        valorRaw = escolhida;
      }
    } else if (campo === 'status') {
      const data = ctx.callbackQuery?.data;
      if (!data || !data.startsWith('st:')) {
        await ctx.reply('👆 Escolha Pago ou Pendente.');
        return;
      }
      await ctx.answerCbQuery();
      valorRaw = data.slice(3);
    } else {
      valorRaw = ctx.message?.text;
      if (campo === 'valor' && (parseValorBRL(valorRaw) === null || parseValorBRL(valorRaw) <= 0)) {
        await ctx.reply('❌ Valor inválido. Ex.: 250 ou 250,50 (ou /cancelar).');
        return;
      }
      if (campo === 'data_vencimento' && !parseData(valorRaw)) {
        await ctx.reply('❌ Data inválida. Envie "hoje" ou DD/MM (ou /cancelar).');
        return;
      }
      if (campo === 'descricao' && !valorRaw?.trim()) {
        await ctx.reply('❌ Envie a descrição em texto (ou /cancelar).');
        return;
      }
    }

    st.valorRaw = valorRaw;
    return pedirConfirmacao(ctx, montarResumoEdicao(st.mov, campo, valorRaw));
  },

  // Ao confirmar, aplica a edição ou a exclusão.
  criarPassoConfirmacao(async (ctx) => {
    const st = ctx.wizard.state;
    try {
      if (st.campo === 'excluir') {
        const r = await fluxoService.excluirMovimentacao(st.movId);
        await ctx.reply(montarRespostaExclusao(r));
      } else {
        const r = await fluxoService.editarMovimentacao(st.movId, st.campo, st.valorRaw);
        await ctx.reply(montarRespostaEdicao(r));
      }
    } catch (err) {
      await responderErro(ctx, err, st.campo === 'excluir' ? 'excluir a movimentação' : 'editar a movimentação');
    }
  })
);
