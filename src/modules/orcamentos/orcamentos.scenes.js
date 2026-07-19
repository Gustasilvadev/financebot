import { Scenes, Markup } from 'telegraf';
import * as orcamentosService from './orcamentos.service.js';
import { parseValorBRL, formatarBRL } from '../../shared/formatters/currency.js';
import { tentarCancelar, responderErro, tecladoCategoriasComOutra } from '../../shared/scenes/helpers.js';
import { pedirConfirmacao, criarPassoConfirmacao } from '../../shared/scenes/confirmacao.js';

// Teclado com os orçamentos existentes (para apagar).
function tecladoOrcamentos(orcamentos) {
  return Markup.inlineKeyboard(
    orcamentos.map((o) => [
      Markup.button.callback(`${o.categoria} — ${formatarBRL(o.valor_limite)}`, `del:${o.id}`),
    ])
  );
}

// Wizard de /addorcamento: escolhe a categoria, informa o limite, confirma e salva.
const addOrcamentoScene = new Scenes.WizardScene(
  'add-orcamento',

  // Sugere as categorias já usadas como botões.
  async (ctx) => {
    const cats = await orcamentosService.categoriasSugeridas();
    ctx.wizard.state.cats = cats;
    await ctx.reply('🎯 Orçamento para qual categoria? (/cancelar para abortar)', tecladoCategoriasComOutra(cats));
    return ctx.wizard.next();
  },

  // Recebe a categoria (botão ou texto de "Outra") e pergunta o limite.
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;

    if (ctx.wizard.state.esperaCategoriaTexto) {
      const cat = ctx.message?.text?.trim();
      if (!cat) {
        await ctx.reply('❌ Envie a categoria em texto (ou /cancelar).');
        return;
      }
      ctx.wizard.state.categoria = cat;
      await ctx.reply('💰 Qual o limite mensal? (ex.: 500 ou 500,50)');
      return ctx.wizard.next();
    }

    const data = ctx.callbackQuery?.data;
    if (!data || !data.startsWith('cat:')) {
      await ctx.reply('👆 Escolha uma categoria nos botões (ou /cancelar).');
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
    await ctx.reply('💰 Qual o limite mensal? (ex.: 500 ou 500,50)');
    return ctx.wizard.next();
  },

  // Recebe o limite, valida e pede confirmação.
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;

    const valor = parseValorBRL(ctx.message?.text);
    if (valor === null || valor <= 0) {
      await ctx.reply('❌ Valor inválido. Ex.: 500 ou 500,50 (ou /cancelar).');
      return;
    }
    ctx.wizard.state.limiteRaw = ctx.message.text;

    const st = ctx.wizard.state;
    return pedirConfirmacao(ctx, `🎯 Orçamento:\n• Categoria: ${st.categoria}\n• Limite mensal: ${formatarBRL(valor)}`);
  },

  // Ao confirmar, cria/atualiza o orçamento.
  criarPassoConfirmacao(async (ctx) => {
    const st = ctx.wizard.state;
    try {
      const o = await orcamentosService.salvarOrcamento(st.categoria, st.limiteRaw);
      await ctx.reply(`✅ Orçamento de "${o.categoria}" definido em ${formatarBRL(o.valor_limite)}/mês.`);
    } catch (err) {
      await responderErro(ctx, err, 'salvar o orçamento');
    }
  })
);

// Wizard de /apagarorcamento: escolhe o orçamento, confirma e exclui.
const apagarOrcamentoScene = new Scenes.WizardScene(
  'apagar-orcamento',

  // Lista os orçamentos como botões.
  async (ctx) => {
    const orcamentos = await orcamentosService.listar();
    if (orcamentos.length === 0) {
      await ctx.reply('Você não tem orçamentos cadastrados. Use /addorcamento.');
      return ctx.scene.leave();
    }
    ctx.wizard.state.orcamentos = orcamentos;
    await ctx.reply('🗑️ Qual orçamento apagar?', tecladoOrcamentos(orcamentos));
    return ctx.wizard.next();
  },

  // Recebe a seleção e pede confirmação.
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;

    const data = ctx.callbackQuery?.data;
    if (!data || !data.startsWith('del:')) {
      await ctx.reply('👆 Toque em um dos botões acima (ou /cancelar).');
      return;
    }
    await ctx.answerCbQuery();

    const id = Number(data.slice(4));
    const orcamento = ctx.wizard.state.orcamentos.find((o) => o.id === id);
    if (!orcamento) {
      await ctx.reply('⚠️ Orçamento não encontrado. Recomece com /apagarorcamento.');
      return ctx.scene.leave();
    }
    ctx.wizard.state.orcamento = orcamento;
    return pedirConfirmacao(ctx, `🗑️ Apagar o orçamento de "${orcamento.categoria}" (${formatarBRL(orcamento.valor_limite)})?`);
  },

  // Ao confirmar, exclui o orçamento.
  criarPassoConfirmacao(async (ctx) => {
    const o = ctx.wizard.state.orcamento;
    try {
      await orcamentosService.excluirOrcamento(o.id);
      await ctx.reply(`🗑️ Orçamento de "${o.categoria}" apagado.`);
    } catch (err) {
      await responderErro(ctx, err, 'apagar o orçamento');
    }
  })
);

export const orcamentosScenes = [addOrcamentoScene, apagarOrcamentoScene];
