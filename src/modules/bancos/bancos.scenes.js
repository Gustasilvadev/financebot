import { Scenes, Markup } from 'telegraf';
import * as bancosService from './bancos.service.js';
import { parseValorBRL, formatarBRL } from '../../shared/formatters/currency.js';
import { ErroDeNegocio } from '../../shared/errors/ErroDeNegocio.js';

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
    console.error(`[bancos] Erro ao ${acao}:`, err);
    await ctx.reply('⚠️ Algo deu errado. Tente novamente mais tarde.');
  }
}

// Monta os bancos como botões inline com um prefixo de callback.
function tecladoDeBancos(bancos, prefixo) {
  return Markup.inlineKeyboard(
    bancos.map((b) => [
      Markup.button.callback(`${b.nome} — ${formatarBRL(b.saldo_atual)}`, `${prefixo}:${b.id}`),
    ])
  );
}

// Wizard de /addbanco: pergunta nome e saldo inicial, depois cria o banco.
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

  // Recebe o saldo, valida e salva.
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;

    if (parseValorBRL(ctx.message?.text) === null) {
      await ctx.reply('❌ Valor inválido. Ex.: 1500 ou 1500,50. Tente de novo (ou /cancelar).');
      return;
    }

    try {
      const banco = await bancosService.adicionarBanco(ctx.wizard.state.nome, ctx.message.text);
      await ctx.reply(
        `✅ Banco "${banco.nome}" criado com saldo inicial de ${formatarBRL(banco.saldo_atual)}.`
      );
    } catch (err) {
      await responderErro(ctx, err, 'criar o banco');
    }
    return ctx.scene.leave();
  }
);

// Wizard de /atualizarsaldo: escolhe o banco e substitui o saldo (reconciliação).
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
    await ctx.reply('🔧 Qual banco deseja atualizar?', tecladoDeBancos(bancos, 'sel'));
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
    await ctx.reply(
      `Saldo atual de ${banco.nome}: ${formatarBRL(banco.saldo_atual)}\n\n` +
        `💵 Qual o novo saldo? (ou /cancelar)`
    );
    return ctx.wizard.next();
  },

  // Recebe o novo saldo, valida e atualiza.
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;

    if (parseValorBRL(ctx.message?.text) === null) {
      await ctx.reply('❌ Valor inválido. Ex.: 1500 ou 1500,50. Tente de novo (ou /cancelar).');
      return;
    }

    try {
      const { anterior, atualizado } = await bancosService.atualizarSaldoBanco(
        ctx.wizard.state.bancoId,
        ctx.message.text
      );
      await ctx.reply(
        `✅ Saldo do ${atualizado.nome} atualizado: ` +
          `${formatarBRL(anterior.saldo_atual)} → ${formatarBRL(atualizado.saldo_atual)}.`
      );
    } catch (err) {
      await responderErro(ctx, err, 'atualizar o saldo');
    }
    return ctx.scene.leave();
  }
);

// Wizard de /apagarbanco: escolhe o banco e exclui após confirmação.
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
    await ctx.reply('🗑️ Qual banco deseja apagar?', tecladoDeBancos(bancos, 'del'));
    return ctx.wizard.next();
  },

  // Recebe a seleção e pede confirmação explícita.
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
    const teclado = Markup.inlineKeyboard([
      [Markup.button.callback('✅ Confirmar', 'confirmar')],
      [Markup.button.callback('↩️ Cancelar', 'cancelar')],
    ]);
    await ctx.reply(
      `Apagar "${banco.nome}" (${formatarBRL(banco.saldo_atual)})? Esta ação é irreversível.`,
      teclado
    );
    return ctx.wizard.next();
  },

  // Executa a exclusão se confirmado.
  async (ctx) => {
    if (await tentarCancelar(ctx)) return;

    const escolha = ctx.callbackQuery?.data;
    if (escolha !== 'confirmar' && escolha !== 'cancelar') {
      await ctx.reply('👆 Toque em Confirmar ou Cancelar.');
      return;
    }
    await ctx.answerCbQuery();

    if (escolha === 'cancelar') {
      await ctx.reply('↩️ Exclusão cancelada.');
      return ctx.scene.leave();
    }

    try {
      const banco = await bancosService.excluirBanco(ctx.wizard.state.banco.id);
      await ctx.reply(`🗑️ Banco "${banco.nome}" apagado.`);
    } catch (err) {
      await responderErro(ctx, err, 'apagar o banco');
    }
    return ctx.scene.leave();
  }
);

export const bancosScenes = [addBancoScene, atualizarSaldoScene, apagarBancoScene];
