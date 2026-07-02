import { supabase } from '../../config/supabaseClient.js';

const TABELA = 'bancos';

// Lista todos os bancos ordenados por nome.
export async function listarTodos() {
  const { data, error } = await supabase
    .from(TABELA)
    .select('*')
    .order('nome', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Busca um banco pelo id (null se não existir).
export async function buscarPorId(id) {
  const { data, error } = await supabase
    .from(TABELA)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Busca um banco pelo nome, case-insensitive (para checar duplicidade).
export async function buscarPorNome(nome) {
  const { data, error } = await supabase
    .from(TABELA)
    .select('*')
    .ilike('nome', nome)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Insere um novo banco e retorna o registro criado.
export async function criar({ nome, saldoInicial }) {
  const { data, error } = await supabase
    .from(TABELA)
    .insert({ nome, saldo_atual: saldoInicial })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Atualiza o saldo e o timestamp de um banco.
export async function atualizarSaldo(id, novoSaldo) {
  const { data, error } = await supabase
    .from(TABELA)
    .update({
      saldo_atual: novoSaldo,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Remove um banco pelo id (movimentações vinculadas ficam com banco_id nulo).
export async function excluir(id) {
  const { error } = await supabase.from(TABELA).delete().eq('id', id);
  if (error) throw error;
}
