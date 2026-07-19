import * as recorrenciasRepository from './recorrencias.repository.js';
import * as fluxoService from '../fluxoCaixa/fluxoCaixa.service.js';
import * as bancosService from '../bancos/bancos.service.js';
import { parseValorBRL } from '../../shared/formatters/currency.js';
import { hojeISO, dataDoMesComDia } from '../../shared/formatters/date.js';
import { ErroDeNegocio } from '../../shared/errors/ErroDeNegocio.js';

const DESCRICAO_MAX = 255;
const CATEGORIA_MAX = 50;
const VALOR_MAX = 9999999999.99;

// Valida e normaliza a descrição.
function validarDescricao(raw) {
  const descricao = String(raw ?? '').trim();
  if (descricao === '') throw new ErroDeNegocio('A descrição não pode ser vazia.');
  if (descricao.length > DESCRICAO_MAX) throw new ErroDeNegocio('Descrição muito longa (máx. 255).');
  return descricao;
}

// Valida um valor monetário positivo.
function validarValor(raw) {
  const valor = parseValorBRL(raw);
  if (valor === null || valor <= 0) throw new ErroDeNegocio('Valor inválido. Ex.: 39,90.');
  if (valor > VALOR_MAX) throw new ErroDeNegocio('Valor acima do limite suportado.');
  return valor;
}

// Valida o dia de vencimento (inteiro de 1 a 31).
function validarDia(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 31) throw new ErroDeNegocio('Dia inválido (1 a 31).');
  return n;
}

// Cria uma recorrência.
export async function salvarRecorrencia(dados) {
  const descricao = validarDescricao(dados.descricao);
  const valor = validarValor(dados.valorRaw);
  const dia = validarDia(dados.diaRaw);
  const tipo = dados.tipo === 'RECEITA' ? 'RECEITA' : 'DESPESA';
  const categoria = (String(dados.categoria ?? '').trim() || 'Geral').slice(0, CATEGORIA_MAX);
  await bancosService.buscarBanco(dados.bancoId);

  return recorrenciasRepository.criar({
    descricao,
    valor,
    tipo,
    categoria,
    dia_vencimento: dia,
    banco_id: dados.bancoId,
    ativo: true,
  });
}

// Lista todas as recorrências.
export function listar() {
  return recorrenciasRepository.listarTodas();
}

// Liga/desliga uma recorrência e retorna o registro atualizado.
export async function alternarAtivo(id) {
  const rec = await recorrenciasRepository.buscarPorId(id);
  if (!rec) throw new ErroDeNegocio('Recorrência não encontrada.');
  return recorrenciasRepository.atualizarAtivo(id, !rec.ativo);
}

// Exclui uma recorrência (as movimentações já lançadas permanecem).
export async function excluir(id) {
  const rec = await recorrenciasRepository.buscarPorId(id);
  if (!rec) throw new ErroDeNegocio('Recorrência não encontrada.');
  await recorrenciasRepository.excluir(id);
  return rec;
}

// Categorias já usadas (sugestões para o wizard).
export function categoriasSugeridas() {
  return fluxoService.listarCategoriasUsadas();
}

// Materializa as recorrências ativas cujo vencimento do mês já chegou (idempotente).
export async function materializarDoDia() {
  const ativas = await recorrenciasRepository.listarAtivas();
  const hoje = hojeISO();
  const criadas = [];

  for (const rec of ativas) {
    const dataVencimento = dataDoMesComDia(rec.dia_vencimento);
    if (hoje < dataVencimento) continue;
    const movimentacao = await fluxoService.criarDeRecorrenciaSeInexistente(rec, dataVencimento);
    if (movimentacao) criadas.push({ recorrencia: rec, movimentacao });
  }

  return criadas;
}
