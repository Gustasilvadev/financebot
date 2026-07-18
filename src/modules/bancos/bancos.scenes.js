import { Scenes } from 'telegraf';
import * as bancosService from './bancos.service.js';
import { parseValorBRL, formatarBRL } from '../../shared/formatters/currency.js';
import { tentarCancelar, responderErro, tecladoBancos } from '../../shared/scenes/helpers.js';
import { pedirConfirmacao, criarPassoConfirmacao } from '../../shared/scenes/confirmacao.js';

// Wizard de /addbanco: pergunta nome e saldo inicial, confirma e cria o banco.
const addBancoScene = new Scenes.WizardScene(
  'add-banco',

  // Pergunta o nome.
  async (ctx) => {
    await ctx.reply('🏦 Qual o nome do novo banco? (/cancelar para abortar)');
    return ctx.wizard.next();
  },

  // Recebe o nome e pergunta o saldo inicial.
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;

    const nome = ctx.message?.text?.trim();
    if (!nome) {
      await ctx.reply('❌ Envie o nome do banco em texto (ou /cancelar).');
      return;
    }

    ctx.wizard.state.nome = nome;
    await ctx.reply('💵 Qual o saldo inicial? (envie 0 se não souber, ou /cancelar)');
    return ctx.wizard.next();
  },

  // Recebe o saldo, valida e pede confirmação.
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;

    const valor = parseValorBRL(ctx.message?.text);
    if (valor === null) {
      await ctx.reply('❌ Valor inválido. Ex.: 1500 ou 1500,50. Tente de novo (ou /cancelar).');
      return;
    }
    ctx.wizard.state.saldoRaw = ctx.message.text;

    const resumo =
      `🏦 Confira o banco:\n` +
      `• Nome: ${ctx.wizard.state.nome}\n` +
      `• Saldo inicial: ${formatarBRL(valor)}`;
    return pedirConfirmacao(ctx, resumo);
  },

  // Ao confirmar, cria o banco.
  criarPassoConfirmacao(async (ctx) => {
    const st = ctx.wizard.state;
    try {
      const banco = await bancosService.adicionarBanco(st.nome, st.saldoRaw);
      await ctx.reply(`✅ Banco "${banco.nome}" criado com saldo inicial de ${formatarBRL(banco.saldo_atual)}.`);
    } catch (err) {
      await responderErro(ctx, err, 'criar o banco');
    }
  })
);

// Wizard de /atualizarsaldo: escolhe o banco, confirma e substitui o saldo.
const atualizarSaldoScene = new Scenes.WizardScene(
  'atualizar-saldo',

  // Lista os bancos como botões.
  async (ctx) => {
    const { bancos } = await bancosService.listarComTotal();
    if (bancos.length === 0) {
      await ctx.reply('Você ainda não tem bancos cadastrados. Use /addbanco primeiro.');
      return ctx.scene.leave();
    }

    ctx.wizard.state.bancos = bancos;
    await ctx.reply('🔧 Qual banco deseja atualizar?', tecladoBancos(bancos, 'sel'));
    return ctx.wizard.next();
  },

  // Recebe a seleção e pergunta o novo saldo.
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;

    const data = ctx.callbackQuery?.data;
    if (!data || !data.startsWith('sel:')) {
      await ctx.reply('👆 Toque em um dos botões acima (ou /cancelar).');
      return;
    }
    await ctx.answerCbQuery();

    const id = Number(data.slice(4));
    const banco = ctx.wizard.state.bancos.find((b) => b.id === id);
    if (!banco) {
      await ctx.reply('⚠️ Banco não encontrado. Recomece com /atualizarsaldo.');
      return ctx.scene.leave();
    }

    ctx.wizard.state.bancoId = id;
    ctx.wizard.state.bancoNome = banco.nome;
    ctx.wizard.state.saldoAtual = banco.saldo_atual;
    await ctx.reply(
      `Saldo atual de ${banco.nome}: ${formatarBRL(banco.saldo_atual)}\n\n` +
        `💵 Qual o novo saldo? (ou /cancelar)`
    );
    return ctx.wizard.next();
  },

  // Recebe o novo saldo, valida e pede confirmação.
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;

    const valor = parseValorBRL(ctx.message?.text);
    if (valor === null) {
      await ctx.reply('❌ Valor inválido. Ex.: 1500 ou 1500,50. Tente de novo (ou /cancelar).');
      return;
    }
    ctx.wizard.state.novoSaldoRaw = ctx.message.text;

    const st = ctx.wizard.state;
    const resumo =
      `🔧 Confira a atualização:\n` +
      `• Banco: ${st.bancoNome}\n` +
      `• Saldo: ${formatarBRL(st.saldoAtual)} → ${formatarBRL(valor)}`;
    return pedirConfirmacao(ctx, resumo);
  },

  // Ao confirmar, atualiza o saldo.
  criarPassoConfirmacao(async (ctx) => {
    const st = ctx.wizard.state;
    try {
      const { anterior, atualizado } = await bancosService.atualizarSaldoBanco(st.bancoId, st.novoSaldoRaw);
      await ctx.reply(
        `✅ Saldo do ${atualizado.nome} atualizado: ` +
          `${formatarBRL(anterior.saldo_atual)} → ${formatarBRL(atualizado.saldo_atual)}.`
      );
    } catch (err) {
      await responderErro(ctx, err, 'atualizar o saldo');
    }
  })
);

// Wizard de /apagarbanco: escolhe o banco, confirma e exclui.
const apagarBancoScene = new Scenes.WizardScene(
  'apagar-banco',

  // Lista os bancos como botões.
  async (ctx) => {
    const { bancos } = await bancosService.listarComTotal();
    if (bancos.length === 0) {
      await ctx.reply('Você não tem bancos cadastrados.');
      return ctx.scene.leave();
    }

    ctx.wizard.state.bancos = bancos;
    await ctx.reply('🗑️ Qual banco deseja apagar?', tecladoBancos(bancos, 'del'));
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
    const banco = ctx.wizard.state.bancos.find((b) => b.id === id);
    if (!banco) {
      await ctx.reply('⚠️ Banco não encontrado. Recomece com /apagarbanco.');
      return ctx.scene.leave();
    }

    ctx.wizard.state.banco = banco;
    return pedirConfirmacao(
      ctx,
      `🗑️ Apagar "${banco.nome}" (${formatarBRL(banco.saldo_atual)})?\nEsta ação é irreversível.`
    );
  },

  // Ao confirmar, exclui o banco.
  criarPassoConfirmacao(async (ctx) => {
    try {
      const banco = await bancosService.excluirBanco(ctx.wizard.state.banco.id);
      await ctx.reply(`🗑️ Banco "${banco.nome}" apagado.`);
    } catch (err) {
      await responderErro(ctx, err, 'apagar o banco');
    }
  })
);

export const bancosScenes = [addBancoScene, atualizarSaldoScene, apagarBancoScene];
