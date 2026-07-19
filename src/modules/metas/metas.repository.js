import { supabase } from '../../config/supabaseClient.js';

const TABELA = 'metas';
const TABELA_TX = 'meta_transacoes';

// Lista todas as metas, em ordem alfabética.
export async function listarTodas() {
  const { data, error } = await supabase.from(TABELA).select('*').order('nome', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Busca uma meta pelo id (null se não existir).
export async function buscarPorId(id) {
  const { data, error } = await supabase.from(TABELA).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// Cria uma meta e retorna o registro.
export async function criar({ nome, valor_objetivo }) {
  const { data, error } = await supabase.from(TABELA).insert({ nome, valor_objetivo }).select().single();
  if (error) throw error;
  return data;
}

// Atualiza o saldo guardado de uma meta e retorna o registro.
export async function atualizarSaldoGuardado(id, novoSaldo) {
  const { data, error } = await supabase
    .from(TABELA)
    .update({ saldo_guardado: novoSaldo })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Remove uma meta pelo id.
export async function excluir(id) {
  const { error } = await supabase.from(TABELA).delete().eq('id', id);
  if (error) throw error;
}

// Registra uma transferência (GUARDAR/RESGATAR) no log.
export async function registrarTransacao({ meta_id, banco_id, tipo, valor }) {
  const { error } = await supabase.from(TABELA_TX).insert({ meta_id, banco_id, tipo, valor });
  if (error) throw error;
}
