import { supabase } from '../../config/supabaseClient.js';

const TABELA = 'movimentacoes';

// Insere uma ou várias movimentações (parcelas).
export async function criarVarias(linhas) {
  const { data, error } = await supabase.from(TABELA).insert(linhas).select();
  if (error) throw error;
  return data ?? [];
}

// Lista as movimentações com vencimento dentro do intervalo.
export async function listarDoMes(inicio, fim) {
  const { data, error } = await supabase
    .from(TABELA)
    .select('*')
    .gte('data_vencimento', inicio)
    .lte('data_vencimento', fim)
    .order('data_vencimento', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Lista as movimentações PENDENTES com vencimento no intervalo.
export async function listarPendentesDoMes(inicio, fim) {
  const { data, error } = await supabase
    .from(TABELA)
    .select('*')
    .eq('status', 'PENDENTE')
    .gte('data_vencimento', inicio)
    .lte('data_vencimento', fim)
    .order('data_vencimento', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Busca uma movimentação pelo id (null se não existir).
export async function buscarPorId(id) {
  const { data, error } = await supabase
    .from(TABELA)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Marca uma movimentação como PAGA e retorna o registro atualizado.
export async function marcarComoPago(id) {
  const { data, error } = await supabase
    .from(TABELA)
    .update({ status: 'PAGO' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
