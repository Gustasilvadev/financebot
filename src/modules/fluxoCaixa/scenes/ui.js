import { Markup } from 'telegraf';

export const TAMANHO_PAGINA = 6;

export const CATEGORIAS = {
  DESPESA: ['Alimentação', 'Transporte', 'Moradia', 'Contas', 'Saúde', 'Lazer', 'Compras', 'Outra'],
  RECEITA: ['Salário', 'Freelance', 'Vendas', 'Investimentos', 'Presente', 'Outra'],
};

// Teclado de categorias (2 por linha), com callback pelo índice.
export function tecladoCategorias(categorias) {
  const linhas = [];
  for (let i = 0; i < categorias.length; i += 2) {
    const linha = [Markup.button.callback(categorias[i], `cat:${i}`)];
    if (categorias[i + 1]) linha.push(Markup.button.callback(categorias[i + 1], `cat:${i + 1}`));
    linhas.push(linha);
  }
  return Markup.inlineKeyboard(linhas);
}

// Teclado de status (Pago / Pendente).
export function tecladoStatus() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Pago', 'st:PAGO'), Markup.button.callback('⏳ Pendente', 'st:PENDENTE')],
  ]);
}

// Recorta a página atual de uma lista.
export function paginar(contas, pagina) {
  const totalPaginas = Math.max(1, Math.ceil(contas.length / TAMANHO_PAGINA));
  const p = Math.min(Math.max(pagina, 0), totalPaginas - 1);
  const itens = contas.slice(p * TAMANHO_PAGINA, p * TAMANHO_PAGINA + TAMANHO_PAGINA);
  return { itens, p, totalPaginas };
}

// Junta as categorias fixas com as já usadas no histórico ("Outra" fica por último).
export function mesclarCategorias(tipo, usadas) {
  const fixas = CATEGORIAS[tipo].filter((c) => c !== 'Outra');
  const extras = [...new Set(usadas)]
    .filter((c) => c && c !== 'Outra' && !fixas.includes(c))
    .slice(0, 8);
  return [...fixas, ...extras, 'Outra'];
}
