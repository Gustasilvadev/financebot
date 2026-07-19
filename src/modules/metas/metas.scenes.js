import { Scenes, Markup } from 'telegraf';
import * as metasService from './metas.service.js';
import * as bancosService from '../bancos/bancos.service.js';
import { parseValorBRL, formatarBRL } from '../../shared/formatters/currency.js';
import { tentarCancelar, responderErro, tecladoBancos } from '../../shared/scenes/helpers.js';
import { pedirConfirmacao, criarPassoConfirmacao } from '../../shared/scenes/confirmacao.js';

// Botões das metas, com prefixo de callback.
function tecladoMetas(metas, prefixo) {
  return Markup.inlineKeyboard(
    metas.map((m) => [
      Markup.button.callback(`🐷 ${m.nome} — ${formatarBRL(m.saldo_guardado)}/${formatarBRL(m.valor_objetivo)}`, `${prefixo}:${m.id}`),
    ])
  );
}

// Wizard de /addmeta: nome → objetivo → confirma → cria.
const addMetaScene = new Scenes.WizardScene(
  'add-meta',

  async (ctx) => {
    await ctx.reply('🐷 Qual o nome da caixinha? (ex.: Viagem, Reserva) (/cancelar para abortar)');
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (await tentarCancelar(ctx)) return;
    const nome = ctx.message?.text?.trim();
    if (!nome) {
      await ctx.reply('❌ Envie o nome em texto (ou /cancelar).');
      return;
    }
    ctx.wizard.state.nome = nome;
    await ctx.reply('🎯 Qual o valor objetivo? (ex.: 5000)');
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (await tentarCancelar(ctx)) return;
    const valor = parseValorBRL(ctx.message?.text);
    if (valor === null || valor <= 0) {
      await ctx.reply('❌ Valor inválido. Ex.: 5000 (ou /cancelar).');
      return;
    }
    ctx.wizard.state.objetivoRaw = ctx.message.text;
    return pedirConfirmacao(ctx, `🐷 Nova caixinha:\n• Nome: ${ctx.wizard.state.nome}\n• Objetivo: ${formatarBRL(valor)}`);
  },

  criarPassoConfirmacao(async (ctx) => {
    const st = ctx.wizard.state;
    try {
      const meta = await metasService.criarMeta(st.nome, st.objetivoRaw);
      await ctx.reply(`✅ Caixinha "${meta.nome}" criada (objetivo ${formatarBRL(meta.valor_objetivo)}).`);
    } catch (err) {
      await responderErro(ctx, err, 'criar a meta');
    }
  })
);

// Fábrica dos wizards de transferência /guardar e /resgatar (meta → banco → valor → confirma).
function criarWizardTransferencia(sceneId, tipo) {
  const ehGuardar = tipo === 'GUARDAR';

  return new Scenes.WizardScene(
    sceneId,

    // Lista as metas.
    async (ctx) => {
      const metas = await metasService.listar();
      if (metas.length === 0) {
        await ctx.reply('Você não tem caixinhas. Use /addmeta primeiro.');
        return ctx.scene.leave();
      }
      ctx.wizard.state.metas = metas;
      await ctx.reply(ehGuardar ? '🐷 Guardar em qual caixinha?' : '🐷 Resgatar de qual caixinha?', tecladoMetas(metas, 'meta'));
      return ctx.wizard.next();
    },

    // Recebe a meta e lista os bancos.
    async (ctx) => {
      if (await tentarCancelar(ctx)) return;
      const data = ctx.callbackQuery?.data;
      if (!data || !data.startsWith('meta:')) {
        await ctx.reply('👆 Escolha uma caixinha nos botões (ou /cancelar).');
        return;
      }
      await ctx.answerCbQuery();
      const meta = ctx.wizard.state.metas.find((m) => m.id === Number(data.slice(5)));
      if (!meta) {
        await ctx.reply('⚠️ Caixinha não encontrada. Recomece o comando.');
        return ctx.scene.leave();
      }
      ctx.wizard.state.meta = meta;

      const { bancos } = await bancosService.listarComTotal();
      if (bancos.length === 0) {
        await ctx.reply('⚠️ Cadastre um banco antes (use /addbanco).');
        return ctx.scene.leave();
      }
      ctx.wizard.state.bancos = bancos;
      await ctx.reply(ehGuardar ? '🏦 De qual banco sai o dinheiro?' : '🏦 Para qual banco vai o dinheiro?', tecladoBancos(bancos, 'bank'));
      return ctx.wizard.next();
    },

    // Recebe o banco e pergunta o valor.
    async (ctx) => {
      if (await tentarCancelar(ctx)) return;
      const data = ctx.callbackQuery?.data;
      if (!data || !data.startsWith('bank:')) {
        await ctx.reply('👆 Escolha um banco nos botões.');
        return;
      }
      await ctx.answerCbQuery();
      const banco = ctx.wizard.state.bancos.find((b) => b.id === Number(data.slice(5)));
      ctx.wizard.state.banco = banco;
      await ctx.reply('💰 Qual valor?');
      return ctx.wizard.next();
    },

    // Recebe o valor, valida e pede confirmação.
    async (ctx) => {
      if (await tentarCancelar(ctx)) return;
      const valor = parseValorBRL(ctx.message?.text);
      if (valor === null || valor <= 0) {
        await ctx.reply('❌ Valor inválido. Ex.: 100 ou 100,50 (ou /cancelar).');
        return;
      }
      const st = ctx.wizard.state;

      if (!ehGuardar && valor > Number(st.meta.saldo_guardado)) {
        await ctx.reply(`❌ A caixinha "${st.meta.nome}" só tem ${formatarBRL(st.meta.saldo_guardado)}. Envie outro valor (ou /cancelar).`);
        return;
      }
      ctx.wizard.state.valorRaw = ctx.message.text;

      const linhas = ehGuardar
        ? [`🐷 Guardar ${formatarBRL(valor)}`, `• Caixinha: ${st.meta.nome}`, `• Sai do banco: ${st.banco.nome}`]
        : [`🐷 Resgatar ${formatarBRL(valor)}`, `• Da caixinha: ${st.meta.nome}`, `• Vai para o banco: ${st.banco.nome}`];
      if (ehGuardar && valor > Number(st.banco.saldo_atual)) {
        linhas.push(`⚠️ Isso deixa "${st.banco.nome}" negativo (saldo atual ${formatarBRL(st.banco.saldo_atual)}).`);
      }
      return pedirConfirmacao(ctx, linhas.join('\n'));
    },

    // Ao confirmar, executa a transferência.
    criarPassoConfirmacao(async (ctx) => {
      const st = ctx.wizard.state;
      try {
        if (ehGuardar) {
          const { meta, valor, atingiu } = await metasService.guardar(st.meta.id, st.banco.id, st.valorRaw);
          let msg = `✅ ${formatarBRL(valor)} guardado em "${meta.nome}" (${formatarBRL(meta.saldo_guardado)}/${formatarBRL(meta.valor_objetivo)}).`;
          if (atingiu) msg += `\n🎉 Objetivo atingido!`;
          await ctx.reply(msg);
        } else {
          const { meta, valor } = await metasService.resgatar(st.meta.id, st.banco.id, st.valorRaw);
          await ctx.reply(`✅ ${formatarBRL(valor)} resgatado de "${meta.nome}" para ${st.banco.nome} (restam ${formatarBRL(meta.saldo_guardado)}).`);
        }
      } catch (err) {
        await responderErro(ctx, err, ehGuardar ? 'guardar na meta' : 'resgatar da meta');
      }
    })
  );
}

// Wizard de /apagarmeta: escolhe, confirma e exclui (bloqueia se houver saldo).
const apagarMetaScene = new Scenes.WizardScene(
  'apagar-meta',

  async (ctx) => {
    const metas = await metasService.listar();
    if (metas.length === 0) {
      await ctx.reply('Você não tem caixinhas.');
      return ctx.scene.leave();
    }
    ctx.wizard.state.metas = metas;
    await ctx.reply('🗑️ Qual caixinha apagar?', tecladoMetas(metas, 'del'));
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
    const meta = ctx.wizard.state.metas.find((m) => m.id === Number(data.slice(4)));
    if (!meta) {
      await ctx.reply('⚠️ Caixinha não encontrada. Recomece com /apagarmeta.');
      return ctx.scene.leave();
    }
    if (Number(meta.saldo_guardado) > 0) {
      await ctx.reply(`⚠️ "${meta.nome}" ainda tem ${formatarBRL(meta.saldo_guardado)} guardado. Use /resgatar antes de apagar.`);
      return ctx.scene.leave();
    }
    ctx.wizard.state.meta = meta;
    return pedirConfirmacao(ctx, `🗑️ Apagar a caixinha "${meta.nome}"?`);
  },

  criarPassoConfirmacao(async (ctx) => {
    const meta = ctx.wizard.state.meta;
    try {
      await metasService.excluir(meta.id);
      await ctx.reply(`🗑️ Caixinha "${meta.nome}" apagada.`);
    } catch (err) {
      await responderErro(ctx, err, 'apagar a meta');
    }
  })
);

const guardarScene = criarWizardTransferencia('guardar', 'GUARDAR');
const resgatarScene = criarWizardTransferencia('resgatar', 'RESGATAR');

export const metasScenes = [addMetaScene, guardarScene, resgatarScene, apagarMetaScene];
