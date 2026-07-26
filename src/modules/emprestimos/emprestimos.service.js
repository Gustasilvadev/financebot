import * as emprestimosRepository from './emprestimos.repository.js';
import * as bancosService from '../bancos/bancos.service.js';
import { parseValorBRL } from '../../shared/formatters/currency.js';
import { parseData, hojeISO, intervaloDoMes, adicionarMeses } from '../../shared/formatters/date.js';
import { ErroDeNegocio } from '../../shared/errors/ErroDeNegocio.js';

const DEVEDOR_MAX = 100;
const VALOR_MAX = 9999999999.99;
const PARCELAS_MAX = 12;

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

// Valida o número de parcelas.
function validarParcelas(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > PARCELAS_MAX) {
    throw new ErroDeNegocio(`Número de parcelas inválido (1 a ${PARCELAS_MAX}).`);
  }
  return n;
}

// Divide um total em N parcelas iguais, jogando a sobra de centavos na última.
function dividirEmParcelas(total, n) {
  const base = Math.floor((total / n) * 100) / 100;
  const parcelas = Array(n).fill(base);
  parcelas[n - 1] = Math.round((total - base * (n - 1)) * 100) / 100;
  return parcelas;
}

// Gera as N linhas do empréstimo, com vencimentos mensais e sufixo "(i/N)" no devedor.
function gerarParcelasEmprestimo({ devedor, valorEmprestado, valorAcordado, dataVencimento, numeroParcelas }) {
  const emprestados = dividirEmParcelas(valorEmprestado, numeroParcelas);
  const acordados = dividirEmParcelas(valorAcordado, numeroParcelas);
  const hoje = hojeISO();
  const linhas = [];
  for (let i = 1; i <= numeroParcelas; i++) {
    const nome = numeroParcelas > 1 ? `${devedor} (${i}/${numeroParcelas})` : devedor;
    linhas.push({
      devedor: nome,
      valor_emprestado: emprestados[i - 1],
      valor_acordado: acordados[i - 1],
      data_emprestimo: hoje,
      data_vencimento_final: adicionarMeses(dataVencimento, i - 1),
      status: 'ATIVO',
    });
  }
  return linhas;
}

// Registra um empréstimo (à vista ou parcelado) e debita o total emprestado do banco.
export async function registrarEmprestimo(dados) {
  const devedor = validarDevedor(dados.devedor);
  const valorEmprestado = validarValor(dados.valorEmprestadoRaw);
  const valorAcordado = validarValor(dados.valorAcordadoRaw);
  const numeroParcelas = validarParcelas(dados.numeroParcelas);

  if (valorAcordado < valorEmprestado) {
    throw new ErroDeNegocio('O valor acordado não pode ser menor que o emprestado.');
  }

  const dataVencimento = parseData(dados.dataRaw);
  if (!dataVencimento) throw new ErroDeNegocio('Data inválida. Envie "hoje" ou no formato DD/MM.');
  if (dataVencimento < hojeISO()) throw new ErroDeNegocio('O vencimento não pode ser anterior a hoje.');

  const { bancoId } = dados;
  await bancosService.buscarBanco(bancoId);

  const linhas = gerarParcelasEmprestimo({ devedor, valorEmprestado, valorAcordado, dataVencimento, numeroParcelas });
  await emprestimosRepository.criarVarias(linhas);
  await bancosService.ajustarSaldo(bancoId, -valorEmprestado);

  return {
    numeroParcelas,
    devedor,
    valorEmprestado,
    valorAcordado,
    primeiroVencimento: dataVencimento,
    ultimoVencimento: adicionarMeses(dataVencimento, numeroParcelas - 1),
  };
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
