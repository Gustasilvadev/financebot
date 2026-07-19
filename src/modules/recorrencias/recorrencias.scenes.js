import { Scenes, Markup } from 'telegraf';
import * as recorrenciasService from './recorrencias.service.js';
import * as bancosService from '../bancos/bancos.service.js';
import { parseValorBRL, formatarBRL } from '../../shared/formatters/currency.js';
import { tentarCancelar, responderErro, tecladoBancos, tecladoCategoriasComOutra } from '../../shared/scenes/helpers.js';
import { pedirConfirmacao, criarPassoConfirmacao } from '../../shared/scenes/confirmacao.js';

const ROTULO_TIPO = { DESPESA: 'Despesa', RECEITA: 'Receita' };

// Teclado para escolher o tipo da recorrência.
function tecladoTipo() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📉 Despesa', 'tp:DESPESA'), Markup.button.callback('📈 Receita', 'tp:RECEITA')],
  ]);
}

// Botões das recorrências (pausar/apagar), com prefixo de callback.
function tecladoRecorrencias(recorrencias, prefixo) {
  return Markup.inlineKeyboard(
    recorrencias.map((r) => [
      Markup.button.callback(
        `${r.ativo ? '✅' : '💤'} ${r.descricao} — ${formatarBRL(r.valor)} (dia ${r.dia_vencimento})`,
        `${prefixo}:${r.id}`
      ),
    ])
  );
}

// Resumo de confirmação a partir do estado do wizard.
function montarResumo(st) {
  const valor = parseValorBRL(st.valorRaw);
  return [
    '🔁 Confira a recorrência:',
    `• Tipo: ${ROTULO_TIPO[st.tipo]}`,
    `• Descrição: ${st.descricao}`,
    `• Valor: ${formatarBRL(valor)}`,
    `• Categoria: ${st.categoria}`,
    `• Todo dia: ${st.dia}`,
    `• Banco: ${st.bancoNome}`,
  ].join('\n');
}

// Wizard de /addrecorrencia: descrição → valor → tipo → categoria → dia → banco → confirma.
const addRecorrenciaScene = new Scenes.WizardScene(
  'add-recorrencia',

  async (ctx) => {
    await ctx.reply('🔁 Qual a descrição da recorrência? (/cancelar para abortar)');
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (await tentarCancelar(ctx)) return;
    const desc = ctx.message?.text?.trim();
    if (!desc) {
      await ctx.reply('❌ Envie a descrição em texto (ou /cancelar).');
      return;
    }
    ctx.wizard.state.descricao = desc;
    await ctx.reply('💵 Qual o valor? (ex.: 39,90)');
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (await tentarCancelar(ctx)) return;
    const valor = parseValorBRL(ctx.message?.text);
    if (valor === null || valor <= 0) {
      await ctx.reply('❌ Valor inválido. Ex.: 39,90 (ou /cancelar).');
      return;
    }
    ctx.wizard.state.valorRaw = ctx.message.text;
    await ctx.reply('É despesa ou receita?', tecladoTipo());
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (await tentarCancelar(ctx)) return;
    const data = ctx.callbackQuery?.data;
    if (!data || !data.startsWith('tp:')) {
      await ctx.reply('👆 Escolha Despesa ou Receita.');
      return;
    }
    await ctx.answerCbQuery();
    ctx.wizard.state.tipo = data.slice(3);
    ctx.wizard.state.cats = await recorrenciasService.categoriasSugeridas();
    await ctx.reply('🏷️ Escolha a categoria:', tecladoCategoriasComOutra(ctx.wizard.state.cats));
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (await tentarCancelar(ctx)) return;

    if (ctx.wizard.state.esperaCategoriaTexto) {
      const cat = ctx.message?.text?.trim();
      if (!cat) {
        await ctx.reply('❌ Envie a categoria em texto.');
        return;
      }
      ctx.wizard.state.categoria = cat;
      await ctx.reply('📅 Vence todo dia (1 a 31)?');
      return ctx.wizard.next();
    }

    const data = ctx.callbackQuery?.data;
    if (!data || !data.startsWith('cat:')) {
      await ctx.reply('👆 Escolha uma categoria nos botões.');
      return;
    }
    await ctx.answerCbQuery();
    const escolha = data.slice(4);
    if (escolha === 'outra') {
      ctx.wizard.state.esperaCategoriaTexto = true;
      await ctx.reply('✏️ Digite a categoria:');
      return;
    }
    ctx.wizard.state.categoria = ctx.wizard.state.cats[Number(escolha)];
    await ctx.reply('📅 Vence todo dia (1 a 31)?');
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (await tentarCancelar(ctx)) return;
    const n = Number(ctx.message?.text?.trim());
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      await ctx.reply('❌ Dia inválido (1 a 31). Tente de novo (ou /cancelar).');
      return;
    }
    ctx.wizard.state.dia = n;

    const { bancos } = await bancosService.listarComTotal();
    if (bancos.length === 0) {
      await ctx.reply('⚠️ Cadastre um banco antes (use /addbanco).');
      return ctx.scene.leave();
    }
    ctx.wizard.state.bancos = bancos;
    await ctx.reply('🏦 Qual banco?', tecladoBancos(bancos, 'bank'));
    return ctx.wizard.next();
  },

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
    return pedirConfirmacao(ctx, montarResumo(ctx.wizard.state));
  },

  criarPassoConfirmacao(async (ctx) => {
    const st = ctx.wizard.state;
    try {
      const rec = await recorrenciasService.salvarRecorrencia({
        descricao: st.descricao,
        valorRaw: st.valorRaw,
        tipo: st.tipo,
        categoria: st.categoria,
        diaRaw: st.dia,
        bancoId: st.bancoId,
      });
      await ctx.reply(`✅ Recorrência "${rec.descricao}" criada — todo dia ${rec.dia_vencimento}.`);
    } catch (err) {
      await responderErro(ctx, err, 'salvar a recorrência');
    }
  })
);

// Wizard de /pausarrecorrencia: liga/desliga uma recorrência (reversível, sem confirmação).
const pausarRecorrenciaScene = new Scenes.WizardScene(
  'pausar-recorrencia',

  async (ctx) => {
    const recorrencias = await recorrenciasService.listar();
    if (recorrencias.length === 0) {
      await ctx.reply('Você não tem recorrências. Use /addrecorrencia.');
      return ctx.scene.leave();
    }
    ctx.wizard.state.recorrencias = recorrencias;
    await ctx.reply('⏯️ Toque para pausar/retomar:', tecladoRecorrencias(recorrencias, 'tog'));
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (await tentarCancelar(ctx)) return;
    const data = ctx.callbackQuery?.data;
    if (!data || !data.startsWith('tog:')) {
      await ctx.reply('👆 Toque em um dos botões (ou /cancelar).');
      return;
    }
    await ctx.answerCbQuery();
    try {
      const rec = await recorrenciasService.alternarAtivo(Number(data.slice(4)));
      await ctx.reply(rec.ativo ? `✅ "${rec.descricao}" retomada.` : `💤 "${rec.descricao}" pausada.`);
    } catch (err) {
      await responderErro(ctx, err, 'pausar a recorrência');
    }
    return ctx.scene.leave();
  }
);

// Wizard de /apagarrecorrencia: escolhe, confirma e exclui.
const apagarRecorrenciaScene = new Scenes.WizardScene(
  'apagar-recorrencia',

  async (ctx) => {
    const recorrencias = await recorrenciasService.listar();
    if (recorrencias.length === 0) {
      await ctx.reply('Você não tem recorrências.');
      return ctx.scene.leave();
    }
    ctx.wizard.state.recorrencias = recorrencias;
    await ctx.reply('🗑️ Qual recorrência apagar?', tecladoRecorrencias(recorrencias, 'del'));
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (await tentarCancelar(ctx)) return;
    const data = ctx.callbackQuery?.data;
    if (!data || !data.startsWith('del:')) {
      await ctx.reply('👆 Toque em um dos botões (ou /cancelar).');
      return;
    }
    await ctx.answerCbQuery();
    const id = Number(data.slice(4));
    const rec = ctx.wizard.state.recorrencias.find((r) => r.id === id);
    if (!rec) {
      await ctx.reply('⚠️ Recorrência não encontrada. Recomece com /apagarrecorrencia.');
      return ctx.scene.leave();
    }
    ctx.wizard.state.rec = rec;
    return pedirConfirmacao(ctx, `🗑️ Apagar a recorrência "${rec.descricao}"?\n(As movimentações já lançadas permanecem.)`);
  },

  criarPassoConfirmacao(async (ctx) => {
    const rec = ctx.wizard.state.rec;
    try {
      await recorrenciasService.excluir(rec.id);
      await ctx.reply(`🗑️ Recorrência "${rec.descricao}" apagada.`);
    } catch (err) {
      await responderErro(ctx, err, 'apagar a recorrência');
    }
  })
);

export const recorrenciasScenes = [addRecorrenciaScene, pausarRecorrenciaScene, apagarRecorrenciaScene];
