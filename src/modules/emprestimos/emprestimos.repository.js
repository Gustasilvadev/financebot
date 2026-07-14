import { supabase } from '../../config/supabaseClient.js';

const TABELA = 'emprestimos';

// Insere um empréstimo e retorna o registro criado.
export async function criar(dados) {
  const { data, error } = await supabase.from(TABELA).insert(dados).select().single();
  if (error) throw error;
  return data;
}

// Lista os empréstimos ativos, ordenados pelo vencimento final.
export async function listarAtivos() {
  const { data, error } = await supabase
    .from(TABELA)
    .select('*')
    .eq('status', 'ATIVO')
    .order('data_vencimento_final', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Busca um empréstimo pelo id (null se não existir).
export async function buscarPorId(id) {
  const { data, error } = await supabase.from(TABELA).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// Marca um empréstimo como QUITADO e retorna o registro atualizado.
export async function marcarComoQuitado(id) {
  const { data, error } = await supabase
    .from(TABELA)
    .update({ status: 'QUITADO' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Lista os empréstimos ativos que vencem na data informada.
export async function listarVencendoEm(dataISO) {
  const { data, error } = await supabase
    .from(TABELA)
    .select('*')
    .eq('status', 'ATIVO')
    .eq('data_vencimento_final', dataISO);

  if (error) throw error;
  return data ?? [];
}
