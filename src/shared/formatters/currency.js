// Converte texto em formato brasileiro (ex.: 1.500,50) para número; null se inválido.
export function parseValorBRL(entrada) {
  if (entrada === null || entrada === undefined) return null;

  let s = String(entrada).trim().replace(/r\$/i, '').replace(/\s/g, '');
  if (s === '') return null;

  let negativo = false;
  if (s.startsWith('-')) {
    negativo = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }

  if (!/^[0-9.,]+$/.test(s)) return null;

  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
    if (s.includes(',')) return null;
  } else if (s.includes('.')) {
    const partes = s.split('.');
    if (partes.length > 2 || partes[partes.length - 1].length === 3) {
      s = partes.join('');
    }
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;

  const valor = negativo ? -n : n;
  return Math.round(valor * 100) / 100;
}

// Formata um número como moeda brasileira (ex.: R$ 1.900,50).
export function formatarBRL(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor) || 0);
}
