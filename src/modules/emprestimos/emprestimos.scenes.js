import { Scenes, Markup } from 'telegraf';
import * as emprestimosService from './emprestimos.service.js';
import * as bancosService from '../bancos/bancos.service.js';
import { parseValorBRL, formatarBRL } from '../../shared/formatters/currency.js';
import { parseData, formatarData } from '../../shared/formatters/date.js';
import { tentarCancelar, responderErro, tecladoBancos } from '../../shared/scenes/helpers.js';
import { pedirConfirmacao, criarPassoConfirmacao } from '../../shared/scenes/confirmacao.js';

// Monta o resumo de confirmação de um empréstimo a partir do estado do wizard.
function montarResumoEmprestimo(st) {
  return [
    '🤝 Confira o empréstimo:',
    `• Devedor: ${st.devedor}`,
    `• Saiu do bolso: ${formatarBRL(parseValorBRL(st.valorEmprestadoRaw))}`,
    `• A receber: ${formatarBRL(parseValorBRL(st.valorAcordadoRaw))}`,
    `• Vencimento: ${formatarData(parseData(st.dataRaw))}`,
    `• Banco: ${st.bancoNome}`,
  ].join('\n');
}

// Wizard de /emprestar: registra o empréstimo e debita do banco.
const emprestarScene = new Scenes.WizardScene(
  'emprestar',

  // Pergunta o devedor.
  async (ctx) => {
    await ctx.reply('🤝 Para quem você emprestou? (nome do devedor — /cancelar para abortar)');
    return ctx.wizard.next();
  },

  // Recebe o devedor, pergunta o valor emprestado.
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;
    const devedor = ctx.message?.text?.trim();
    if (!devedor) {
      await ctx.reply('❌ Envie o nome em texto (ou /cancelar).');
      return;
    }
    ctx.wizard.state.devedor = devedor;
    await ctx.reply('💸 Quanto saiu do seu bolso? (ex.: 500 ou 500,50)');
    return ctx.wizard.next();
  },

  // Recebe o valor emprestado, pergunta o valor acordado.
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;
    const valor = parseValorBRL(ctx.message?.text);
    if (valor === null || valor <= 0) {
      await ctx.reply('❌ Valor inválido. Ex.: 500 ou 500,50 (ou /cancelar).');
      return;
    }
    ctx.wizard.state.valorEmprestadoRaw = ctx.message.text;
    await ctx.reply('🎯 Quanto foi acordado receber de volta?');
    return ctx.wizard.next();
  },

  // Recebe o valor acordado, pergunta o vencimento.
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;
    const valor = parseValorBRL(ctx.message?.text);
    if (valor === null || valor <= 0) {
      await ctx.reply('❌ Valor inválido. Ex.: 600 ou 600,50 (ou /cancelar).');
      return;
    }
    ctx.wizard.state.valorAcordadoRaw = ctx.message.text;
    await ctx.reply('📅 Qual o vencimento final? ("hoje" ou DD/MM)');
    return ctx.wizard.next();
  },

  // Recebe o vencimento, lista os bancos.
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;
    if (!parseData(ctx.message?.text)) {
      await ctx.reply('❌ Data inválida. Envie "hoje" ou DD/MM (ou /cancelar).');
      return;
    }
    ctx.wizard.state.dataRaw = ctx.message.text;

    const { bancos } = await bancosService.listarComTotal();
    if (bancos.length === 0) {
      await ctx.reply('⚠️ Cadastre um banco antes (use /addbanco).');
      return ctx.scene.leave();
    }
    ctx.wizard.state.bancos = bancos;
    await ctx.reply('🏦 De qual banco saiu o dinheiro?', tecladoBancos(bancos, 'bank'));
    return ctx.wizard.next();
  },

  // Recebe o banco e pede confirmação.
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
    return pedirConfirmacao(ctx, montarResumoEmprestimo(ctx.wizard.state));
  },

  // Ao confirmar, registra o empréstimo.
  criarPassoConfirmacao(async (ctx) => {
    const st = ctx.wizard.state;
    try {
      const emp = await emprestimosService.registrarEmprestimo({
        devedor: st.devedor,
        valorEmprestadoRaw: st.valorEmprestadoRaw,
        valorAcordadoRaw: st.valorAcordadoRaw,
        dataRaw: st.dataRaw,
        bancoId: st.bancoId,
      });
      await ctx.reply(
        `✅ Empréstimo para ${emp.devedor} registrado: saiu ${formatarBRL(emp.valor_emprestado)}, ` +
          `a receber ${formatarBRL(emp.valor_acordado)} até ${formatarData(emp.data_vencimento_final)}.`
      );
    } catch (err) {
      await responderErro(ctx, err, 'registrar o empréstimo');
    }
  })
);

// Wizard de /quitaremprestimo: escolhe o empréstimo, o banco de entrada e credita.
const quitarEmprestimoScene = new Scenes.WizardScene(
  'quitar-emprestimo',

  // Lista os empréstimos ativos como botões.
  async (ctx) => {
    const { emprestimos } = await emprestimosService.listarAtivosComTotal();
    if (emprestimos.length === 0) {
      await ctx.reply('Você não tem empréstimos ativos.');
      return ctx.scene.leave();
    }
    const teclado = Markup.inlineKeyboard(
      emprestimos.map((e) => [
        Markup.button.callback(`${e.devedor} — ${formatarBRL(e.valor_acordado)}`, `emp:${e.id}`),
      ])
    );
    await ctx.reply('💰 Qual empréstimo foi pago?', teclado);
    return ctx.wizard.next();
  },

  // Recebe o empréstimo escolhido, pergunta em qual banco o dinheiro entrou.
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;
    const data = ctx.callbackQuery?.data;
    if (!data || !data.startsWith('emp:')) {
      await ctx.reply('👆 Escolha um empréstimo nos botões (ou /cancelar).');
      return;
    }
    await ctx.answerCbQuery();
    ctx.wizard.state.emprestimoId = Number(data.slice(4));

    const { bancos } = await bancosService.listarComTotal();
    if (bancos.length === 0) {
      await ctx.reply('⚠️ Cadastre um banco antes (use /addbanco).');
      return ctx.scene.leave();
    }
    await ctx.reply('🏦 Em qual banco o dinheiro entrou?', tecladoBancos(bancos, 'bank'));
    return ctx.wizard.next();
  },

  // Recebe o banco, quita e credita.
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;
    const data = ctx.callbackQuery?.data;
    if (!data || !data.startsWith('bank:')) {
      await ctx.reply('👆 Escolha um banco nos botões.');
      return;
    }
    await ctx.answerCbQuery();

    try {
      const { emprestimo, jaQuitado } = await emprestimosService.quitarEmprestimo(
        ctx.wizard.state.emprestimoId,
        Number(data.slice(5))
      );
      if (jaQuitado) {
        await ctx.reply('Esse empréstimo já estava quitado.');
      } else {
        await ctx.reply(
          `✅ Empréstimo de ${emprestimo.devedor} quitado. ${formatarBRL(emprestimo.valor_acordado)} creditados.`
        );
      }
    } catch (err) {
      await responderErro(ctx, err, 'quitar o empréstimo');
    }
    return ctx.scene.leave();
  }
);

export const emprestimosScenes = [emprestarScene, quitarEmprestimoScene];
