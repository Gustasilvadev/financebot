import * as graficosService from './graficos.service.js';
import { urlBarras } from '../../shared/charts/quickchart.js';
import { formatarBRL } from '../../shared/formatters/currency.js';

// Envia o gráfico como imagem; se a QuickChart falhar, cai para o texto (caption).
async function enviarGrafico(ctx, { titulo, itens, percentual }, caption) {
  try {
    await ctx.replyWithPhoto(urlBarras({ titulo, itens, percentual }), { caption });
  } catch (err) {
    console.error('[graficos] Erro ao gerar imagem:', err);
    await ctx.reply(caption);
  }
}

// Legenda de texto (fallback e complemento da imagem).
function legenda(itens) {
  return itens.map((i) => `• ${i.label}: ${formatarBRL(i.valor)}`).join('\n');
}

// Envolve um handler com o try/catch padrão dos gráficos.
function comando(handler) {
  return async (ctx) => {
    try {
      await handler(ctx);
    } catch (err) {
      console.error('[graficos] Erro:', err);
      await ctx.reply('⚠️ Não consegui gerar o gráfico agora. Tente novamente.');
    }
  };
}

// Responde um gráfico de "itens por fonte" (gastos, ganhos) com total e legenda.
async function responderPorFonte(ctx, emoji, dados, vazio) {
  if (dados.itens.length === 0) return ctx.reply(vazio);
  const total = dados.itens.reduce((s, i) => s + i.valor, 0);
  const caption = `${emoji} ${dados.titulo}\nTotal: ${formatarBRL(total)}\n\n${legenda(dados.itens)}`;
  await enviarGrafico(ctx, dados, caption);
}

// Registra os comandos de gráficos no bot.
export function registrarGraficos(bot) {
  bot.command('grafico', comando(async (ctx) =>
    responderPorFonte(ctx, '📊', await graficosService.dadosGastos(), '📊 Nenhuma despesa registrada neste mês.')
  ));

  bot.command('lucro', comando(async (ctx) =>
    responderPorFonte(ctx, '📈', await graficosService.dadosLucro(), '📈 Nenhum ganho registrado neste mês.')
  ));

  bot.command('resultado', comando(async (ctx) => {
    const dados = await graficosService.dadosResultado();
    const caption =
      `⚖️ ${dados.titulo}\n` +
      `📈 Entradas: ${formatarBRL(dados.entradas)}\n` +
      `📉 Gastos: ${formatarBRL(dados.gastos)}\n` +
      `──────────────\n` +
      `💡 Saldo: ${formatarBRL(dados.saldo)}`;
    await enviarGrafico(ctx, dados, caption);
  }));
}
