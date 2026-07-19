const TZ = 'America/Sao_Paulo';
const pad = (n) => String(n).padStart(2, '0');

// Data de hoje no fuso de São Paulo como "YYYY-MM-DD".
export function hojeISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

export function parseData(texto) {
  const t = String(texto ?? '').trim().toLowerCase();
  if (t === '') return null;
  if (t === 'hoje') return hojeISO();

  const m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return null;

  const dia = Number(m[1]);
  const mes = Number(m[2]);
  let ano = m[3] ? Number(m[3]) : Number(hojeISO().slice(0, 4));
  if (m[3] && m[3].length === 2) ano += 2000;

  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return null;
  }
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

export function adicionarMeses(iso, n) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const base = new Date(Date.UTC(ano, mes - 1 + n, 1));
  const y = base.getUTCFullYear();
  const mIndex = base.getUTCMonth();
  const ultimoDia = new Date(Date.UTC(y, mIndex + 1, 0)).getUTCDate();
  return `${y}-${pad(mIndex + 1)}-${pad(Math.min(dia, ultimoDia))}`;
}

// Formata "YYYY-MM-DD" como "DD/MM/AAAA".
export function formatarData(iso) {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function intervaloDoMes(iso = hojeISO()) {
  const [ano, mes] = iso.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return { inicio: `${ano}-${pad(mes)}-01`, fim: `${ano}-${pad(mes)}-${pad(ultimoDia)}` };
}

// Data do mês corrente com o dia informado, limitada ao último dia do mês (ex.: 31 em fev -> 28/29).
export function dataDoMesComDia(dia, iso = hojeISO()) {
  const [ano, mes] = iso.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${pad(mes)}-${pad(Math.min(dia, ultimoDia))}`;
}

// Rótulo do mês em pt-BR, ex.: "Julho/2026".
export function rotuloDoMes(iso = hojeISO()) {
  const [ano, mes] = iso.split('-').map(Number);
  const nome = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(ano, mes - 1, 1)));
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}/${ano}`;
}
