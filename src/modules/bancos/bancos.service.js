import * as bancosRepository from './bancos.repository.js';
import { parseValorBRL } from '../../shared/formatters/currency.js';
import { ErroDeNegocio } from '../../shared/errors/ErroDeNegocio.js';

const NOME_MAX = 100; // limite da coluna VARCHAR(100)
const SALDO_MAX = 9999999999.99; // limite de DECIMAL(12,2)

// Valida e normaliza o nome (obrigatório, até 100 caracteres).
function validarNome(nomeRaw) {
  const nome = String(nomeRaw ?? '').trim();
  if (nome === '') {
    throw new ErroDeNegocio('O nome do banco não pode ser vazio.');
  }
  if (nome.length > NOME_MAX) {
    throw new ErroDeNegocio(`O nome deve ter no máximo ${NOME_MAX} caracteres.`);
  }
  return nome;
}

// Converte e valida um valor monetário; negativos são permitidos (D4).
function validarValor(valorRaw) {
  const valor = parseValorBRL(valorRaw);
  if (valor === null) {
    throw new ErroDeNegocio('Valor inválido. Envie algo como 1500 ou 1500,50.');
  }
  if (Math.abs(valor) > SALDO_MAX) {
    throw new ErroDeNegocio('Valor acima do limite suportado.');
  }
  return valor;
}

// Busca um banco pelo id ou lança erro de negócio se não existir.
export async function buscarBanco(id) {
  const banco = await bancosRepository.buscarPorId(id);
  if (!banco) {
    throw new ErroDeNegocio('Banco não encontrado.');
  }
  return banco;
}

// Lista os bancos e soma o total consolidado.
export async function listarComTotal() {
  const bancos = await bancosRepository.listarTodos();
  const total = bancos.reduce((soma, b) => soma + Number(b.saldo_atual), 0);
  return { bancos, total: Math.round(total * 100) / 100 };
}

// Cria um banco após validar nome/valor e checar duplicidade (D3).
export async function adicionarBanco(nomeRaw, saldoInicialRaw) {
  const nome = validarNome(nomeRaw);
  const saldoInicial = validarValor(saldoInicialRaw);

  const existente = await bancosRepository.buscarPorNome(nome);
  if (existente) {
    throw new ErroDeNegocio(`Já existe um banco chamado "${existente.nome}".`);
  }

  try {
    return await bancosRepository.criar({ nome, saldoInicial });
  } catch (err) {
    if (err?.code === '23505') {
      throw new ErroDeNegocio(`Já existe um banco chamado "${nome}".`);
    }
    throw err;
  }
}

// Reconcilia (substitui) o saldo de um banco e retorna antes/depois.
export async function atualizarSaldoBanco(id, novoSaldoRaw) {
  const banco = await buscarBanco(id);
  const novoSaldo = validarValor(novoSaldoRaw);
  const atualizado = await bancosRepository.atualizarSaldo(id, novoSaldo);
  return { anterior: banco, atualizado };
}

// Exclui um banco existente e retorna o registro removido.
export async function excluirBanco(id) {
  const banco = await buscarBanco(id);
  await bancosRepository.excluir(id);
  return banco;
}
