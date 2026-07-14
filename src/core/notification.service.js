import { bot } from './bot.js';
import { config } from '../config/env.js';
import { supabase } from '../config/supabaseClient.js';
import { formatarBRL } from '../shared/formatters/currency.js';
import { formatarData, hojeISO } from '../shared/formatters/date.js';
import * as fluxoService from '../modules/fluxoCaixa/fluxoCaixa.service.js';
import * as emprestimosService from '../modules/emprestimos/emprestimos.service.js';

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
