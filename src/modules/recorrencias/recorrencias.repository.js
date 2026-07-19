import { supabase } from '../../config/supabaseClient.js';

const TABELA = 'recorrencias';

// Lista todas as recorrências (ativas e pausadas), por dia de vencimento.
export async function listarTodas() {
  const { data, error } = await supabase
    .from(TABELA)
    .select('*')
    .order('dia_vencimento', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Lista apenas as recorrências ativas.
export async function listarAtivas() {
  const { data, error } = await supabase.from(TABELA).select('*').eq('ativo', true);
  if (error) throw error;
  return data ?? [];
}

// Cria uma recorrência e retorna o registro.
export async function criar(dados) {
  const { data, error } = await supabase.from(TABELA).insert(dados).select().single();
  if (error) throw error;
  return data;
}

// Busca uma recorrência pelo id (null se não existir).
export async function buscarPorId(id) {
  const { data, error } = await supabase.from(TABELA).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// Atualiza o campo ativo de uma recorrência e retorna o registro.
export async function atualizarAtivo(id, ativo) {
  const { data, error } = await supabase.from(TABELA).update({ ativo }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// Remove uma recorrência.
export async function excluir(id) {
  const { error } = await supabase.from(TABELA).delete().eq('id', id);
  if (error) throw error;
}
