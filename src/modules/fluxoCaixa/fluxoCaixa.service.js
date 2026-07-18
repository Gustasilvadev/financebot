import * as fluxoRepository from './fluxoCaixa.repository.js';
import * as bancosService from '../bancos/bancos.service.js';
import { parseValorBRL } from '../../shared/formatters/currency.js';
import { parseData, adicionarMeses, intervaloDoMes, rotuloDoMes, hojeISO } from '../../shared/formatters/date.js';
import { ErroDeNegocio } from '../../shared/errors/ErroDeNegocio.js';

const DESCRICAO_MAX = 255;
const CATEGORIA_MAX = 50;
const PARCELAS_MAX = 60;
const VALOR_MAX = 9999999999.99;

// Valida e normaliza a descrição (obrigatória, até 255 caracteres).
function validarDescricao(raw) {
  const descricao = String(raw ?? '').trim();
  if (descricao === '') throw new ErroDeNegocio('A descrição não pode ser vazia.');
  if (descricao.length > DESCRICAO_MAX) throw new ErroDeNegocio('Descrição muito longa (máx. 255).');
  return descricao;
}

// Valida um valor monetário positivo.
function validarValor(raw) {
  const valor = parseValorBRL(raw);
  if (valor === null || valor <= 0) {
    throw new ErroDeNegocio('Valor inválido. Envie algo como 250 ou 250,50.');
  }
  if (valor > VALOR_MAX) throw new ErroDeNegocio('Valor acima do limite suportado.');
  return valor;
}

// Valida a data de vencimento ("hoje" ou DD/MM).
function validarData(raw) {
  const data = parseData(raw);
  if (!data) throw new ErroDeNegocio('Data inválida. Envie "hoje" ou no formato DD/MM.');
  return data;
}

// Valida o número de parcelas (inteiro de 1 a 60).
function validarParcelas(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > PARCELAS_MAX) {
    throw new ErroDeNegocio(`Número de parcelas inválido (1 a ${PARCELAS_MAX}).`);
  }
  return n;
}

// Delta de saldo conforme o tipo: despesa debita, receita credita.
function deltaSaldo(tipo, valor) {
  return tipo === 'DESPESA' ? -valor : valor;
}

function gerarParcelas({ descricao, valor, tipo, categoria, dataVencimento, bancoId, numeroParcelas }) {
  const linhas = [];
  for (let i = 1; i <= numeroParcelas; i++) {
    const data = adicionarMeses(dataVencimento, i - 1);
    const desc = numeroParcelas > 1 ? `${descricao} (${i}/${numeroParcelas})` : descricao;
    linhas.push({
      descricao: desc,
      valor,
      tipo,
      categoria,
      status: 'PENDENTE',
      data_vencimento: data,
      banco_id: bancoId,
    });
  }
  return linhas;
}

// Registra uma movimentação (à vista ou parcelada) e ajusta o saldo se nascer PAGA.
export async function registrarMovimentacao(dados) {
  const descricao = validarDescricao(dados.descricao);
  const valor = validarValor(dados.valorRaw);
  const dataVencimento = validarData(dados.dataRaw);
  const numeroParcelas = validarParcelas(dados.numeroParcelas);
  const categoria = (String(dados.categoria ?? '').trim() || 'Geral').slice(0, CATEGORIA_MAX);
  const { tipo, bancoId } = dados;

  await bancosService.buscarBanco(bancoId);

  const status = numeroParcelas > 1 ? 'PENDENTE' : dados.status;

  const linhas = gerarParcelas({ descricao, valor, tipo, categoria, dataVencimento, bancoId, numeroParcelas });
  linhas[0].status = status;
  const criadas = await fluxoRepository.criarVarias(linhas);

  // Ajusta o saldo apenas quando à vista e já pago.
  if (numeroParcelas === 1 && status === 'PAGO') {
    await bancosService.ajustarSaldo(bancoId, deltaSaldo(tipo, valor));
  }

  return { quantidade: criadas.length, valorParcela: valor, status, dataVencimento, tipo };
}

// Lista as pendentes (despesas e receitas) do mês atual.
export async function listarPendentesDoMes() {
  const { inicio, fim } = intervaloDoMes();
  return fluxoRepository.listarPendentesDoMes(inicio, fim);
}

// Lista as despesas pendentes que vencem hoje (para as notificações).
export async function listarDespesasVencendoHoje() {
  return fluxoRepository.listarDespesasVencendoEm(hojeISO());
}

export async function pagarConta(id) {
  const mov = await fluxoRepository.buscarPorId(id);
  if (!mov) throw new ErroDeNegocio('Movimentação não encontrada.');

  if (mov.status === 'PAGO') return { mov, jaEstavaPaga: true, saldoAjustado: false };

  const paga = await fluxoRepository.marcarComoPago(id);

  let saldoAjustado = false;
  if (paga.banco_id != null) {
    await bancosService.ajustarSaldo(paga.banco_id, deltaSaldo(paga.tipo, Number(paga.valor)));
    saldoAjustado = true;
  }
  return { mov: paga, jaEstavaPaga: false, saldoAjustado };
}

export async function balancoDoMes() {
  const { inicio, fim } = intervaloDoMes();
  const movs = await fluxoRepository.listarDoMes(inicio, fim);

  let receitas = 0;
  let despesasPagas = 0;
  let despesasPendentes = 0;
  for (const m of movs) {
    const v = Number(m.valor);
    if (m.tipo === 'RECEITA') receitas += v;
    else if (m.status === 'PAGO') despesasPagas += v;
    else despesasPendentes += v;
  }

  const arred = (x) => Math.round(x * 100) / 100;
  return {
    rotulo: rotuloDoMes(),
    receitas: arred(receitas),
    despesasPagas: arred(despesasPagas),
    despesasPendentes: arred(despesasPendentes),
    saldoPrevisto: arred(receitas - despesasPagas - despesasPendentes),
    vazio: movs.length === 0,
  };
}

// Contribuição de uma movimentação ao saldo do banco (0 se pendente).
export function efeitoNoSaldo(mov) {
  if (mov.status !== 'PAGO') return 0;
  const valor = Number(mov.valor);
  return mov.tipo === 'DESPESA' ? -valor : valor;
}

// Valida o novo valor de um campo e devolve o objeto para o UPDATE.
function validarCampo(campo, valorRaw) {
  switch (campo) {
    case 'descricao':
      return { descricao: validarDescricao(valorRaw) };
    case 'valor':
      return { valor: validarValor(valorRaw) };
    case 'categoria': {
      const categoria = String(valorRaw ?? '').trim().slice(0, CATEGORIA_MAX);
      if (categoria === '') throw new ErroDeNegocio('A categoria não pode ser vazia.');
      return { categoria };
    }
    case 'data_vencimento':
      return { data_vencimento: validarData(valorRaw) };
    case 'status':
      if (valorRaw !== 'PAGO' && valorRaw !== 'PENDENTE') throw new ErroDeNegocio('Status inválido.');
      return { status: valorRaw };
    default:
      throw new ErroDeNegocio('Campo inválido.');
  }
}

// Lista as movimentações do mês atual (para o /editar).
export async function listarDoMes() {
  const { inicio, fim } = intervaloDoMes();
  return fluxoRepository.listarDoMes(inicio, fim);
}

// Edita um campo de uma movimentação e reconcilia o saldo, se necessário.
export async function editarMovimentacao(id, campo, valorRaw) {
  const antiga = await fluxoRepository.buscarPorId(id);
  if (!antiga) throw new ErroDeNegocio('Movimentação não encontrada.');

  const campos = validarCampo(campo, valorRaw);
  const atualizada = await fluxoRepository.atualizar(id, campos);

  const delta = Math.round((efeitoNoSaldo(atualizada) - efeitoNoSaldo(antiga)) * 100) / 100;
  let saldoAjustado = false;
  let semBanco = false;
  if (delta !== 0) {
    if (atualizada.banco_id != null) {
      await bancosService.ajustarSaldo(atualizada.banco_id, delta);
      saldoAjustado = true;
    } else {
      semBanco = true;
    }
  }
  return { antiga, atualizada, campo, delta, saldoAjustado, semBanco };
}

// Exclui uma movimentação e estorna o saldo, se ela estava paga.
export async function excluirMovimentacao(id) {
  const mov = await fluxoRepository.buscarPorId(id);
  if (!mov) throw new ErroDeNegocio('Movimentação não encontrada.');

  await fluxoRepository.excluir(id);

  const estorno = -efeitoNoSaldo(mov);
  let saldoAjustado = false;
  let semBanco = false;
  if (estorno !== 0) {
    if (mov.banco_id != null) {
      await bancosService.ajustarSaldo(mov.banco_id, estorno);
      saldoAjustado = true;
    } else {
      semBanco = true;
    }
  }
  return { mov, estorno, saldoAjustado, semBanco };
}

// Categorias já usadas no histórico.
export async function listarCategoriasUsadas() {
  return fluxoRepository.listarCategorias();
}
