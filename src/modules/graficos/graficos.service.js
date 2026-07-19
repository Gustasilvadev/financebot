import * as fluxoService from '../fluxoCaixa/fluxoCaixa.service.js';
import * as emprestimosService from '../emprestimos/emprestimos.service.js';
import { agruparTopN } from '../../shared/charts/quickchart.js';
import { rotuloDoMes } from '../../shared/formatters/date.js';

const COR_GASTO = '#e15759';
const COR_LUCRO = '#59a14f';

const arred = (x) => Math.round(x * 100) / 100;

// Gráfico de gastos do mês por categoria.
export async function dadosGastos() {
  const gastos = await fluxoService.gastosPorCategoria();
  const itens = agruparTopN(gastos.map((g) => ({ label: g.categoria, valor: g.total, cor: COR_GASTO })));
  return { titulo: `Gastos por categoria — ${rotuloDoMes()}`, itens, percentual: true };
}

// Gráfico de ganhos: receitas do mês por categoria + lucro realizado de empréstimos.
export async function dadosLucro() {
  const receitas = await fluxoService.receitasPorCategoria();
  const lucroEmp = await emprestimosService.lucroRealizadoNoMes();

  const itens = receitas.map((r) => ({ label: r.categoria, valor: r.total, cor: COR_LUCRO }));
  if (lucroEmp > 0) itens.push({ label: 'Empréstimos', valor: lucroEmp, cor: COR_LUCRO });
  itens.sort((a, b) => b.valor - a.valor);

  return { titulo: `Ganhos — ${rotuloDoMes()}`, itens: agruparTopN(itens), percentual: true };
}

// Comparativo Entradas x Gastos (entradas = receitas do mês + lucro de empréstimos).
export async function dadosResultado() {
  const b = await fluxoService.balancoDoMes();
  const lucroEmp = await emprestimosService.lucroRealizadoNoMes();

  const entradas = arred(b.receitas + lucroEmp);
  const gastos = arred(b.despesasPagas + b.despesasPendentes);
  const itens = [
    { label: 'Entradas', valor: entradas, cor: COR_LUCRO },
    { label: 'Gastos', valor: gastos, cor: COR_GASTO },
  ];

  return { titulo: 'Entradas x Gastos', itens, percentual: false, entradas, gastos, saldo: arred(entradas - gastos) };
}
