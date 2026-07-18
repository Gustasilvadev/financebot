import { Markup } from 'telegraf';
import { tentarCancelar } from './helpers.js';

// Envia o resumo com os botões Confirmar/Cancelar e avança o wizard.
export async function pedirConfirmacao(ctx, resumo) {
  const teclado = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Confirmar', 'confirmar'), Markup.button.callback('❌ Cancelar', 'cancelar')],
  ]);
  await ctx.reply(`${resumo}\n\nConfirmar?`, teclado);
  return ctx.wizard.next();
}

// Cria um passo de wizard que trata a resposta da confirmação.
export function criarPassoConfirmacao(aoConfirmar) {
  return async (ctx) => {
    if (await tentarCancelar(ctx)) return;

    const escolha = ctx.callbackQuery?.data;
    if (escolha !== 'confirmar' && escolha !== 'cancelar') {
      await ctx.reply('👆 Toque em Confirmar ou Cancelar.');
      return;
    }
    await ctx.answerCbQuery();

    if (escolha === 'cancelar') {
      await ctx.reply('❌ Operação cancelada.');
      return ctx.scene.leave();
    }

    await aoConfirmar(ctx);
    return ctx.scene.leave();
  };
}
