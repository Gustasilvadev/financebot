import * as emprestimosRepository from './emprestimos.repository.js';
import * as bancosService from '../bancos/bancos.service.js';
import { parseValorBRL } from '../../shared/formatters/currency.js';
import { parseData, hojeISO, intervaloDoMes } from '../../shared/formatters/date.js';
import { ErroDeNegocio } from '../../shared/errors/ErroDeNegocio.js';

const DEVEDOR_MAX = 100;
const VALOR_MAX = 9999999999.99;

// Valida e normaliza o nome do devedor.
function validarDevedor(raw) {
  const devedor = String(raw ?? '').trim();
  if (devedor === '') throw new ErroDeNegocio('O nome do devedor não pode ser vazio.');
  if (devedor.length > DEVEDOR_MAX) throw new ErroDeNegocio('Nome muito longo (máx. 100).');
  return devedor;
}

// Valida um valor monetário positivo.
function validarValor(raw) {
  const valor = parseValorBRL(raw);
  if (valor === null || valor <= 0) {
    throw new ErroDeNegocio('Valor inválido. Envie algo como 500 ou 500,50.');
  }
  if (valor > VALOR_MAX) throw new ErroDeNegocio('Valor acima do limite suportado.');
  return valor;
}

// Registra um empréstimo e debita o valor emprestado do banco escolhido.
export async function registrarEmprestimo(dados) {
  const devedor = validarDevedor(dados.devedor);
  const valorEmprestado = validarValor(dados.valorEmprestadoRaw);
  const valorAcordado = validarValor(dados.valorAcordadoRaw);

  if (valorAcordado < valorEmprestado) {
    throw new ErroDeNegocio('O valor acordado não pode ser menor que o emprestado.');
  }

  const dataVencimento = parseData(dados.dataRaw);
  if (!dataVencimento) throw new ErroDeNegocio('Data inválida. Envie "hoje" ou no formato DD/MM.');
  const hoje = hojeISO();
  if (dataVencimento < hoje) throw new ErroDeNegocio('O vencimento não pode ser anterior a hoje.');

  const { bancoId } = dados;
  await bancosService.buscarBanco(bancoId);

  const emprestimo = await emprestimosRepository.criar({
    devedor,
    valor_emprestado: valorEmprestado,
    valor_acordado: valorAcordado,
    data_emprestimo: hoje,
    data_vencimento_final: dataVencimento,
    status: 'ATIVO',
  });

  await bancosService.ajustarSaldo(bancoId, -valorEmprestado);

  return emprestimo;
}

// Lista os empréstimos ativos e soma o total a receber.
export async function listarAtivosComTotal() {
  const emprestimos = await emprestimosRepository.listarAtivos();
  const totalAReceber = emprestimos.reduce((soma, e) => soma + Number(e.valor_acordado), 0);
  return { emprestimos, totalAReceber: Math.round(totalAReceber * 100) / 100 };
}

// Quita um empréstimo ativo e credita o valor acordado no banco escolhido.
export async function quitarEmprestimo(id, bancoId) {
  const emprestimo = await emprestimosRepository.buscarPorId(id);
  if (!emprestimo) throw new ErroDeNegocio('Empréstimo não encontrado.');

  if (emprestimo.status === 'QUITADO') return { emprestimo, jaQuitado: true };

  await bancosService.buscarBanco(bancoId);
  const quitado = await emprestimosRepository.marcarComoQuitado(id, hojeISO());
  await bancosService.ajustarSaldo(bancoId, Number(quitado.valor_acordado));

  return { emprestimo: quitado, jaQuitado: false };
}

// Lista os empréstimos que vencem hoje (para as notificações).
export async function listarVencendoHoje() {
  return emprestimosRepository.listarVencendoEm(hojeISO());
}

// Lucro realizado com empréstimos quitados no mês atual (valor_acordado - valor_emprestado).
export async function lucroRealizadoNoMes() {
  const { inicio, fim } = intervaloDoMes();
  const quitados = await emprestimosRepository.listarQuitadosNoMes(inicio, fim);
  const lucro = quitados.reduce((s, e) => s + (Number(e.valor_acordado) - Number(e.valor_emprestado)), 0);
  return Math.round(lucro * 100) / 100;
}
