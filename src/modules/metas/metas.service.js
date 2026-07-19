import * as metasRepository from './metas.repository.js';
import * as bancosService from '../bancos/bancos.service.js';
import { parseValorBRL, formatarBRL } from '../../shared/formatters/currency.js';
import { ErroDeNegocio } from '../../shared/errors/ErroDeNegocio.js';

const NOME_MAX = 100;
const VALOR_MAX = 9999999999.99;

const arred = (x) => Math.round(x * 100) / 100;

// Valida e normaliza o nome da meta.
function validarNome(raw) {
  const nome = String(raw ?? '').trim();
  if (nome === '') throw new ErroDeNegocio('O nome da meta não pode ser vazio.');
  if (nome.length > NOME_MAX) throw new ErroDeNegocio(`O nome deve ter no máximo ${NOME_MAX} caracteres.`);
  return nome;
}

// Valida um valor monetário estritamente positivo.
function validarValorPositivo(raw) {
  const valor = parseValorBRL(raw);
  if (valor === null || valor <= 0) throw new ErroDeNegocio('Valor inválido. Ex.: 100 ou 100,50.');
  if (valor > VALOR_MAX) throw new ErroDeNegocio('Valor acima do limite suportado.');
  return valor;
}

// Busca uma meta ou lança erro de negócio.
export async function buscarMeta(id) {
  const meta = await metasRepository.buscarPorId(id);
  if (!meta) throw new ErroDeNegocio('Meta não encontrada.');
  return meta;
}

// Cria uma meta (nome único).
export async function criarMeta(nomeRaw, objetivoRaw) {
  const nome = validarNome(nomeRaw);
  const valorObjetivo = validarValorPositivo(objetivoRaw);
  try {
    return await metasRepository.criar({ nome, valor_objetivo: valorObjetivo });
  } catch (err) {
    if (err?.code === '23505') throw new ErroDeNegocio(`Já existe uma meta chamada "${nome}".`);
    throw err;
  }
}

// Lista todas as metas.
export function listar() {
  return metasRepository.listarTodas();
}

// Registra a transferência no log sem quebrar a operação se o log falhar.
async function registrarTransacaoSeguro(metaId, bancoId, tipo, valor) {
  try {
    await metasRepository.registrarTransacao({ meta_id: metaId, banco_id: bancoId, tipo, valor });
  } catch (err) {
    console.error('[metas] Falha ao registrar transacao:', err);
  }
}

// Guarda dinheiro: debita o banco e credita a caixinha (com rollback se a caixinha falhar).
export async function guardar(metaId, bancoId, valorRaw) {
  const valor = validarValorPositivo(valorRaw);
  const meta = await buscarMeta(metaId);
  await bancosService.buscarBanco(bancoId);

  await bancosService.ajustarSaldo(bancoId, -valor);
  let atualizada;
  try {
    atualizada = await metasRepository.atualizarSaldoGuardado(metaId, arred(Number(meta.saldo_guardado) + valor));
  } catch (err) {
    await bancosService.ajustarSaldo(bancoId, valor);
    throw err;
  }

  await registrarTransacaoSeguro(metaId, bancoId, 'GUARDAR', valor);
  const atingiu = Number(atualizada.saldo_guardado) >= Number(atualizada.valor_objetivo);
  return { meta: atualizada, valor, atingiu };
}

// Resgata dinheiro: debita a caixinha e credita o banco (com rollback se o banco falhar).
export async function resgatar(metaId, bancoId, valorRaw) {
  const valor = validarValorPositivo(valorRaw);
  const meta = await buscarMeta(metaId);
  await bancosService.buscarBanco(bancoId);

  if (valor > Number(meta.saldo_guardado)) {
    throw new ErroDeNegocio(`Saldo guardado insuficiente. Na meta há ${formatarBRL(meta.saldo_guardado)}.`);
  }

  const atualizada = await metasRepository.atualizarSaldoGuardado(metaId, arred(Number(meta.saldo_guardado) - valor));
  try {
    await bancosService.ajustarSaldo(bancoId, valor);
  } catch (err) {
    await metasRepository.atualizarSaldoGuardado(metaId, Number(meta.saldo_guardado));
    throw err;
  }

  await registrarTransacaoSeguro(metaId, bancoId, 'RESGATAR', valor);
  return { meta: atualizada, valor };
}

// Exclui uma meta (bloqueia se ainda houver saldo guardado).
export async function excluir(id) {
  const meta = await buscarMeta(id);
  if (Number(meta.saldo_guardado) > 0) {
    throw new ErroDeNegocio(`A meta "${meta.nome}" ainda tem ${formatarBRL(meta.saldo_guardado)} guardado. Resgate antes de apagar.`);
  }
  await metasRepository.excluir(id);
  return meta;
}

// Patrimônio total = disponível nos bancos + guardado nas caixinhas.
export async function patrimonio() {
  const { total: disponivel } = await bancosService.listarComTotal();
  const metas = await metasRepository.listarTodas();
  const guardado = arred(metas.reduce((s, m) => s + Number(m.saldo_guardado), 0));
  return { disponivel, guardado, total: arred(disponivel + guardado) };
}
