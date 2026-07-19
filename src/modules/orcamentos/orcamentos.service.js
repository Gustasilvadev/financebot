import * as orcamentosRepository from './orcamentos.repository.js';
import * as fluxoService from '../fluxoCaixa/fluxoCaixa.service.js';
import { parseValorBRL } from '../../shared/formatters/currency.js';
import { ErroDeNegocio } from '../../shared/errors/ErroDeNegocio.js';

const CATEGORIA_MAX = 50;
const VALOR_MAX = 9999999999.99;
const LIMIAR_AVISO = 0.8;

// Valida o valor-limite (positivo, dentro do teto).
function validarLimite(raw) {
  const valor = parseValorBRL(raw);
  if (valor === null || valor <= 0) throw new ErroDeNegocio('Valor inválido. Ex.: 500 ou 500,50.');
  if (valor > VALOR_MAX) throw new ErroDeNegocio('Valor acima do limite suportado.');
  return valor;
}

// Monta o consumo de um orçamento: { categoria, limite, gasto, percentual, nivel }.
function montarConsumo(orcamento, gasto) {
  const limite = Number(orcamento.valor_limite);
  const g = Math.round(gasto * 100) / 100;
  const percentual = limite > 0 ? Math.round((g / limite) * 100) : 0;
  let nivel = 'ok';
  if (g >= limite) nivel = 'estourado';
  else if (g >= limite * LIMIAR_AVISO) nivel = 'aviso';
  return { categoria: orcamento.categoria, limite, gasto: g, percentual, nivel };
}

// Cria ou atualiza o orçamento de uma categoria.
export async function salvarOrcamento(categoriaRaw, valorRaw) {
  const categoria = String(categoriaRaw ?? '').trim().slice(0, CATEGORIA_MAX);
  if (categoria === '') throw new ErroDeNegocio('A categoria não pode ser vazia.');
  const valorLimite = validarLimite(valorRaw);
  return orcamentosRepository.salvar(categoria, valorLimite);
}

// Lista os orçamentos com o consumo do mês (uma única agregação de gastos).
export async function listarComConsumo() {
  const orcamentos = await orcamentosRepository.listarAtivos();
  if (orcamentos.length === 0) return [];
  const gastos = await fluxoService.gastosPorCategoria();
  const mapa = new Map(gastos.map((g) => [g.categoria, g.total]));
  return orcamentos.map((o) => montarConsumo(o, mapa.get(o.categoria) ?? 0));
}

// Consumo de uma categoria (para o alerta no lançamento); null se não houver orçamento.
export async function verificarConsumo(categoria) {
  const orcamento = await orcamentosRepository.buscarPorCategoria(categoria);
  if (!orcamento) return null;
  const gasto = await fluxoService.somarDespesasDoMes(categoria);
  return montarConsumo(orcamento, gasto);
}

// Categorias já usadas (sugestões para o wizard de orçamento).
export function categoriasSugeridas() {
  return fluxoService.listarCategoriasUsadas();
}

// Lista os orçamentos (para o /apagarorcamento).
export function listar() {
  return orcamentosRepository.listarAtivos();
}

// Remove um orçamento.
export function excluirOrcamento(id) {
  return orcamentosRepository.excluir(id);
}
