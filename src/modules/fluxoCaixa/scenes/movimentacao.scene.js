import { Scenes } from 'telegraf';
import * as fluxoService from '../fluxoCaixa.service.js';
import * as bancosService from '../../bancos/bancos.service.js';
import { parseValorBRL, formatarBRL } from '../../../shared/formatters/currency.js';
import { parseData, formatarData } from '../../../shared/formatters/date.js';
import { tentarCancelar, responderErro, tecladoBancos } from '../../../shared/scenes/helpers.js';
import { pedirConfirmacao, criarPassoConfirmacao } from '../../../shared/scenes/confirmacao.js';
import { mesclarCategorias, tecladoCategorias, tecladoStatus } from './ui.js';

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
      const usadas = await fluxoService.listarCategoriasUsadas();
      ctx.wizard.state.categorias = mesclarCategorias(tipo, usadas);
      await ctx.reply('🏷️ Escolha a categoria:', tecladoCategorias(ctx.wizard.state.categorias));
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
      const escolhida = ctx.wizard.state.categorias[Number(data.slice(4))];
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

export const gastoScene = criarWizardMovimentacao('add-gasto', 'DESPESA');
export const receitaScene = criarWizardMovimentacao('add-receita', 'RECEITA');
