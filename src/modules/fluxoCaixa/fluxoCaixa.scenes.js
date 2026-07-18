import { Scenes, Markup } from 'telegraf';
import * as fluxoService from './fluxoCaixa.service.js';
import * as bancosService from '../bancos/bancos.service.js';
import { parseValorBRL, formatarBRL } from '../../shared/formatters/currency.js';
import { parseData, formatarData } from '../../shared/formatters/date.js';
import { tentarCancelar, responderErro, tecladoBancos } from '../../shared/scenes/helpers.js';
import { pedirConfirmacao, criarPassoConfirmacao } from '../../shared/scenes/confirmacao.js';

const TAMANHO_PAGINA = 6;

const CATEGORIAS = {
  DESPESA: ['Alimentação', 'Transporte', 'Moradia', 'Contas', 'Saúde', 'Lazer', 'Compras', 'Outra'],
  RECEITA: ['Salário', 'Freelance', 'Vendas', 'Investimentos', 'Presente', 'Outra'],
};

// Teclado de categorias (2 por linha), com callback pelo índice.
function tecladoCategorias(categorias) {
  const linhas = [];
  for (let i = 0; i < categorias.length; i += 2) {
    const linha = [Markup.button.callback(categorias[i], `cat:${i}`)];
    if (categorias[i + 1]) linha.push(Markup.button.callback(categorias[i + 1], `cat:${i + 1}`));
    linhas.push(linha);
  }
  return Markup.inlineKeyboard(linhas);
}

// Teclado de status (Pago / Pendente).
function tecladoStatus() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Pago', 'st:PAGO'), Markup.button.callback('⏳ Pendente', 'st:PENDENTE')],
  ]);
}

// Pergunta o vencimento e avança para o passo da data.
async function perguntarData(ctx) {
  await ctx.reply('📅 Qual o vencimento? ("hoje" ou DD/MM)');
  return ctx.wizard.next();
}

// Monta a mensagem de sucesso do registro (à vista ou parcelado).
function montarResumo(r, descricao) {
  const venc = formatarData(r.dataVencimento);
  const tipoTxt = r.tipo === 'DESPESA' ? 'Despesa' : 'Receita';
  if (r.quantidade > 1) {
    return `✅ "${descricao}" parcelada em ${r.quantidade}x de ${formatarBRL(r.valorParcela)} — ` +
      `${r.quantidade} lançamentos PENDENTES (a partir de ${venc}).`;
  }
  return `✅ ${tipoTxt} "${descricao}" de ${formatarBRL(r.valorParcela)} registrada (vence ${venc}, ${r.status}).`;
}

// Monta o resumo de confirmação de um lançamento a partir do estado do wizard.
function montarResumoConfirmacao(st) {
  const valor = parseValorBRL(st.valorRaw);
  const tipoTxt = st.tipo === 'DESPESA' ? 'Despesa' : 'Receita';
  const valorTxt =
    st.numeroParcelas > 1
      ? `${st.numeroParcelas}x de ${formatarBRL(valor)}`
      : `${formatarBRL(valor)} (à vista)`;
  const status = st.numeroParcelas > 1 ? 'PENDENTE' : st.status;
  return [
    '📝 Confira o lançamento:',
    `• Tipo: ${tipoTxt}`,
    `• Descrição: ${st.descricao}`,
    `• Valor: ${valorTxt}`,
    `• Categoria: ${st.categoria}`,
    `• Vencimento: ${formatarData(parseData(st.dataRaw))}`,
    `• Status: ${status}`,
    `• Banco: ${st.bancoNome}`,
  ].join('\n');
}

// Fábrica dos wizards de /gasto e /receita.
function criarWizardMovimentacao(sceneId, tipo) {
  const categorias = CATEGORIAS[tipo];
  const rotuloTipo = tipo === 'DESPESA' ? 'despesa' : 'receita';

  return new Scenes.WizardScene(
    sceneId,

    // Pergunta a descrição.
    async (ctx) => {
      ctx.wizard.state.tipo = tipo;
      await ctx.reply(`📝 Qual a descrição da ${rotuloTipo}? (/cancelar para abortar)`);
      return ctx.wizard.next();
    },

    // Recebe a descrição, pede o valor.
    async (ctx) => {
      if (await tentarCancelar(ctx)) return;
      const desc = ctx.message?.text?.trim();
      if (!desc) {
        await ctx.reply('❌ Envie a descrição em texto (ou /cancelar).');
        return;
      }
      ctx.wizard.state.descricao = desc;
      await ctx.reply('💵 Qual o valor? (ex.: 250 ou 250,50)');
      return ctx.wizard.next();
    },

    // Recebe o valor, mostra as categorias.
    async (ctx) => {
      if (await tentarCancelar(ctx)) return;
      const valor = parseValorBRL(ctx.message?.text);
      if (valor === null || valor <= 0) {
        await ctx.reply('❌ Valor inválido. Ex.: 250 ou 250,50 (ou /cancelar).');
        return;
      }
      ctx.wizard.state.valorRaw = ctx.message.text;
      await ctx.reply('🏷️ Escolha a categoria:', tecladoCategorias(categorias));
      return ctx.wizard.next();
    },

    // Recebe a categoria (botão) ou o texto livre quando escolheu "Outra".
    async (ctx) => {
      if (await tentarCancelar(ctx)) return;

      if (ctx.wizard.state.esperaCategoriaTexto) {
        const cat = ctx.message?.text?.trim();
        if (!cat) {
          await ctx.reply('❌ Envie a categoria em texto.');
          return;
        }
        ctx.wizard.state.categoria = cat;
        return perguntarData(ctx);
      }

      const data = ctx.callbackQuery?.data;
      if (!data || !data.startsWith('cat:')) {
        await ctx.reply('👆 Escolha uma categoria nos botões.');
        return;
      }
      await ctx.answerCbQuery();
      const escolhida = categorias[Number(data.slice(4))];
      if (escolhida === 'Outra') {
        ctx.wizard.state.esperaCategoriaTexto = true;
        await ctx.reply('✏️ Digite a categoria:');
        return;
      }
      ctx.wizard.state.categoria = escolhida;
      return perguntarData(ctx);
    },

    // Recebe a data, pede o status.
    async (ctx) => {
      if (await tentarCancelar(ctx)) return;
      if (!parseData(ctx.message?.text)) {
        await ctx.reply('❌ Data inválida. Envie "hoje" ou DD/MM (ou /cancelar).');
        return;
      }
      ctx.wizard.state.dataRaw = ctx.message.text;
      await ctx.reply('Está pago ou pendente?', tecladoStatus());
      return ctx.wizard.next();
    },

    // Recebe o status, lista os bancos.
    async (ctx) => {
      if (await tentarCancelar(ctx)) return;
      const data = ctx.callbackQuery?.data;
      if (!data || !data.startsWith('st:')) {
        await ctx.reply('👆 Escolha Pago ou Pendente.');
        return;
      }
      await ctx.answerCbQuery();
      ctx.wizard.state.status = data.slice(3);

      const { bancos } = await bancosService.listarComTotal();
      if (bancos.length === 0) {
        await ctx.reply('⚠️ Cadastre um banco antes (use /addbanco).');
        return ctx.scene.leave();
      }
      ctx.wizard.state.bancos = bancos;
      await ctx.reply('🏦 Qual banco?', tecladoBancos(bancos, 'bank'));
      return ctx.wizard.next();
    },

    // Recebe o banco, pergunta o número de parcelas.
    async (ctx) => {
      if (await tentarCancelar(ctx)) return;
      const data = ctx.callbackQuery?.data;
      if (!data || !data.startsWith('bank:')) {
        await ctx.reply('👆 Escolha um banco nos botões.');
        return;
      }
      await ctx.answerCbQuery();
      const bancoId = Number(data.slice(5));
      ctx.wizard.state.bancoId = bancoId;
      ctx.wizard.state.bancoNome = ctx.wizard.state.bancos?.find((b) => b.id === bancoId)?.nome ?? '—';
      await ctx.reply('🔢 Quantas parcelas? (1 = à vista)');
      return ctx.wizard.next();
    },

    // Recebe as parcelas, valida e pede confirmação.
    async (ctx) => {
      if (await tentarCancelar(ctx)) return;
      const n = Number(ctx.message?.text?.trim());
      if (!Number.isInteger(n) || n < 1 || n > 60) {
        await ctx.reply('❌ Número de parcelas inválido (1 a 60). Tente de novo (ou /cancelar).');
        return;
      }
      ctx.wizard.state.numeroParcelas = n;
      return pedirConfirmacao(ctx, montarResumoConfirmacao(ctx.wizard.state));
    },

    // Ao confirmar, registra a movimentação.
    criarPassoConfirmacao(async (ctx) => {
      const st = ctx.wizard.state;
      try {
        const resultado = await fluxoService.registrarMovimentacao({
          descricao: st.descricao,
          valorRaw: st.valorRaw,
          tipo: st.tipo,
          categoria: st.categoria,
          dataRaw: st.dataRaw,
          status: st.status,
          bancoId: st.bancoId,
          numeroParcelas: st.numeroParcelas,
        });
        await ctx.reply(montarResumo(resultado, st.descricao));
      } catch (err) {
        await responderErro(ctx, err, 'registrar a movimentação');
      }
    })
  );
}

// Recorta a página atual da lista de contas.
function paginar(contas, pagina) {
  const totalPaginas = Math.max(1, Math.ceil(contas.length / TAMANHO_PAGINA));
  const p = Math.min(Math.max(pagina, 0), totalPaginas - 1);
  const itens = contas.slice(p * TAMANHO_PAGINA, p * TAMANHO_PAGINA + TAMANHO_PAGINA);
  return { itens, p, totalPaginas };
}

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

const pagarContaScene = new Scenes.WizardScene(
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

const editarLancamentoScene = new Scenes.WizardScene(
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

export const fluxoCaixaScenes = [
  criarWizardMovimentacao('add-gasto', 'DESPESA'),
  criarWizardMovimentacao('add-receita', 'RECEITA'),
  pagarContaScene,
  editarLancamentoScene,
];
