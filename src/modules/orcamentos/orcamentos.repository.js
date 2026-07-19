import { supabase } from '../../config/supabaseClient.js';

const TABELA = 'orcamentos';

// Lista os orçamentos ativos, em ordem alfabética de categoria.
export async function listarAtivos() {
  const { data, error } = await supabase
    .from(TABELA)
    .select('*')
    .eq('ativo', true)
    .order('categoria', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Busca o orçamento ativo de uma categoria (null se não existir).
export async function buscarPorCategoria(categoria) {
  const { data, error } = await supabase
    .from(TABELA)
    .select('*')
    .eq('categoria', categoria)
    .eq('ativo', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Cria ou atualiza (por categoria) o limite de um orçamento.
export async function salvar(categoria, valorLimite) {
  const { data, error } = await supabase
    .from(TABELA)
    .upsert({ categoria, valor_limite: valorLimite, ativo: true }, { onConflict: 'categoria' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Remove um orçamento pelo id.
export async function excluir(id) {
  const { error } = await supabase.from(TABELA).delete().eq('id', id);
  if (error) throw error;
}
