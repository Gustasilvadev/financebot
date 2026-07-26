import { bot } from './bot.js';
import { config } from '../config/env.js';
import { supabase } from '../config/supabaseClient.js';
import { formatarBRL } from '../shared/formatters/currency.js';
import { formatarData, hojeISO } from '../shared/formatters/date.js';
import * as fluxoService from '../modules/fluxoCaixa/fluxoCaixa.service.js';
import * as emprestimosService from '../modules/emprestimos/emprestimos.service.js';
import * as recorrenciasService from '../modules/recorrencias/recorrencias.service.js';
import * as metasService from '../modules/metas/metas.service.js';

// Faz uma query trivial só para manter o Supabase acordado.
export async function manterVivo() {
  const { error } = await supabase.from('bancos').select('id').limit(1);
  if (error) throw error;
  return 'ok';
}

// Busca vencimentos de hoje e, se houver, envia uma mensagem proativa ao dono.
export async function notificarVencimentosDeHoje() {
  const [despesas, emprestimos] = await Promise.all([
    fluxoService.listarDespesasVencendoHoje(),
    emprestimosService.listarVencendoHoje(),
  ]);

  if (despesas.length === 0 && emprestimos.length === 0) {
    return { enviado: false };
  }

  const linhas = [`🔔 Vencimentos de hoje (${formatarData(hojeISO())})`];
  let total = 0;

  if (despesas.length > 0) {
    linhas.push('', '📉 Despesas pendentes:');
    for (const d of despesas) {
      linhas.push(`• ${d.descricao} — ${formatarBRL(d.valor)}`);
      total += Number(d.valor);
    }
  }

  if (emprestimos.length > 0) {
    linhas.push('', '🤝 Empréstimos a receber:');
    for (const e of emprestimos) {
      linhas.push(`• ${e.devedor} — ${formatarBRL(e.valor_acordado)}`);
      total += Number(e.valor_acordado);
    }
  }

  linhas.push('', `Total do dia: ${formatarBRL(Math.round(total * 100) / 100)}`);

  await bot.telegram.sendMessage(config.telegramUserId, linhas.join('\n'));
  return { enviado: true, despesas: despesas.length, emprestimos: emprestimos.length };
}

// Materializa as recorrências do dia (como PENDENTES) e avisa o dono do que foi lançado.
export async function materializarRecorrenciasDeHoje() {
  const criadas = await recorrenciasService.materializarDoDia();
  if (criadas.length === 0) return { materializadas: 0 };

  const linhas = ['🔁 Recorrências lançadas hoje:'];
  let total = 0;
  for (const { recorrencia, movimentacao } of criadas) {
    const emoji = recorrencia.tipo === 'DESPESA' ? '📉' : '📈';
    linhas.push(`${emoji} ${movimentacao.descricao} — ${formatarBRL(movimentacao.valor)} (vence ${formatarData(movimentacao.data_vencimento)}, PENDENTE)`);
    total += Number(movimentacao.valor);
  }
  linhas.push('', `Total: ${formatarBRL(Math.round(total * 100) / 100)}`);

  await bot.telegram.sendMessage(config.telegramUserId, linhas.join('\n'));
  return { materializadas: criadas.length };
}

// No dia 1 do mês, se houver caixinhas, lembra de registrar os rendimentos.
export async function lembrarFechamentoDeCaixinhas() {
  if (Number(hojeISO().slice(8, 10)) !== 1) return { lembrete: false };
  const metas = await metasService.listar();
  if (metas.length === 0) return { lembrete: false };

  await bot.telegram.sendMessage(
    config.telegramUserId,
    '🔔 Dia de Fechamento! Verifique o app do banco e use /atualizar_caixinha para registrar os rendimentos das suas caixinhas.'
  );
  return { lembrete: true };
}

// Rotina diária do cron: materializa recorrências, notifica vencimentos e lembra do fechamento.
export async function rotinaDiaria() {
  const recorrencias = await materializarRecorrenciasDeHoje();
  const vencimentos = await notificarVencimentosDeHoje();
  const caixinhas = await lembrarFechamentoDeCaixinhas();
  return { recorrencias, vencimentos, caixinhas };
}
