import { Markup } from 'telegraf';
import { formatarBRL } from '../formatters/currency.js';
import { ErroDeNegocio } from '../errors/ErroDeNegocio.js';

// Encerra a scene se o usuário mandou /cancelar. Retorna true se cancelou.
export async function tentarCancelar(ctx) {
  if (ctx.message?.text?.trim() === '/cancelar') {
    await ctx.reply('❌ Operação cancelada.');
    await ctx.scene.leave();
    return true;
  }
  return false;
}

// Responde erro de negócio com a mensagem própria; erro inesperado com genérica.
export async function responderErro(ctx, err, acao) {
  if (err instanceof ErroDeNegocio) {
    await ctx.reply(`⚠️ ${err.message}`);
  } else {
    console.error(`[cena] Erro ao ${acao}:`, err);
    await ctx.reply('⚠️ Algo deu errado. Tente novamente mais tarde.');
  }
}

// Teclado com os bancos disponíveis, usando um prefixo de callback.
export function tecladoBancos(bancos, prefixo) {
  return Markup.inlineKeyboard(
    bancos.map((b) => [
      Markup.button.callback(`${b.nome} — ${formatarBRL(b.saldo_atual)}`, `${prefixo}:${b.id}`),
    ])
  );
}

// Teclado de categorias sugeridas (2 por linha, callback "cat:i") + opção "Outra" (cat:outra).
export function tecladoCategoriasComOutra(cats) {
  const linhas = [];
  for (let i = 0; i < cats.length; i += 2) {
    const linha = [Markup.button.callback(cats[i], `cat:${i}`)];
    if (cats[i + 1]) linha.push(Markup.button.callback(cats[i + 1], `cat:${i + 1}`));
    linhas.push(linha);
  }
  linhas.push([Markup.button.callback('✏️ Outra categoria', 'cat:outra')]);
  return Markup.inlineKeyboard(linhas);
}
