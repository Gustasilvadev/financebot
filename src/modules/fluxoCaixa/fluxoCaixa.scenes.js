import { Scenes, Markup } from 'telegraf';
import * as fluxoService from './fluxoCaixa.service.js';
import * as bancosService from '../bancos/bancos.service.js';
import { parseValorBRL, formatarBRL } from '../../shared/formatters/currency.js';
import { parseData, formatarData } from '../../shared/formatters/date.js';
import { ErroDeNegocio } from '../../shared/errors/ErroDeNegocio.js';

const TAMANHO_PAGINA = 6;

const CATEGORIAS = {
  DESPESA: ['Alimentação', 'Transporte', 'Moradia', 'Contas', 'Saúde', 'Lazer', 'Compras', 'Outra'],
  RECEITA: ['Salário', 'Freelance', 'Vendas', 'Investimentos', 'Presente', 'Outra'],
};

// Encerra a scene se o usuário mandou /cancelar. Retorna true se cancelou.
async function tentarCancelar(ctx) {
  if (ctx.message?.text?.trim() === '/cancelar') {
    await ctx.reply('❌ Operação cancelada.');
    await ctx.scene.leave();
    return true;
  }
  return false;
}

// Responde erro de negócio com a mensagem própria; erro inesperado com genérica.
async function responderErro(ctx, err, acao) {
  if (err instanceof ErroDeNegocio) {
    await ctx.reply(`⚠️ ${err.message}`);
  } else {
    console.error(`[fluxoCaixa] Erro ao ${acao}:`, err);
    await ctx.reply('⚠️ Algo deu errado. Tente novamente mais tarde.');
  }
}

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

// Teclado com os bancos disponíveis.
function tecladoBancos(bancos) {
  return Markup.inlineKeyboard(
    bancos.map((b) => [Markup.button.callback(`${b.nome} — ${formatarBRL(b.saldo_atual)}`, `bank:${b.id}`)])
  );
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
      await ctx.reply('🏦 Qual banco?', tecladoBancos(bancos));
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
      ctx.wizard.state.bancoId = Number(data.slice(5));
      await ctx.reply('🔢 Quantas parcelas? (1 = à vista)');
      return ctx.wizard.next();
    },

    // Recebe as parcelas, registra a movimentação.
    async (ctx) => {
      if (await tentarCancelar(ctx)) return;
      const n = Number(ctx.message?.text?.trim());
      if (!Number.isInteger(n) || n < 1 || n > 60) {
        await ctx.reply('❌ Número de parcelas inválido (1 a 60). Tente de novo (ou /cancelar).');
        return;
      }

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
          numeroParcelas: n,
        });
        await ctx.reply(montarResumo(resultado, st.descricao));
      } catch (err) {
        await responderErro(ctx, err, 'registrar a movimentação');
      }
      return ctx.scene.leave();
    }
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

export const fluxoCaixaScenes = [
  criarWizardMovimentacao('add-gasto', 'DESPESA'),
  criarWizardMovimentacao('add-receita', 'RECEITA'),
  pagarContaScene,
];
