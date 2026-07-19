const BASE = 'https://quickchart.io/chart';
const COR_PADRAO = '#4e79a7';

// Mantém os N maiores itens e agrupa o restante em "Outros".
export function agruparTopN(itens, limite = 8) {
  if (itens.length <= limite) return itens;
  const principais = itens.slice(0, limite);
  const resto = itens.slice(limite).reduce((s, i) => s + i.valor, 0);
  return [...principais, { label: 'Outros', valor: Math.round(resto * 100) / 100 }];
}

// Função (executada pela QuickChart) que formata o rótulo da barra.
function formatterRotulo(total, percentual) {
  const valor = "var d=v.toFixed(2).split('.');var i=d[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g,'.');var s='R$ '+i+','+d[1];";
  if (!percentual) return `function(v){${valor}return s;}`;
  return `function(v){${valor}var p=${total}>0?Math.round(v/${total}*100):0;return s+'  ('+p+'%)';}`;
}

// Monta a URL de barras horizontais (config vai como texto JS, nao JSON, para preservar as funcoes de formatacao).
export function urlBarras({ titulo, itens, percentual = true }) {
  const labels = itens.map((i) => i.label);
  const valores = itens.map((i) => i.valor);
  const cores = itens.map((i) => i.cor || COR_PADRAO);
  const total = valores.reduce((s, v) => s + v, 0);
  const altura = Math.max(240, 90 + labels.length * 48);

  const config = `{
    type: 'bar',
    data: {
      labels: ${JSON.stringify(labels)},
      datasets: [{ data: ${JSON.stringify(valores)}, backgroundColor: ${JSON.stringify(cores)}, borderRadius: 4 }]
    },
    options: {
      indexAxis: 'y',
      layout: { padding: { right: 12 } },
      plugins: {
        legend: { display: false },
        title: { display: true, text: ${JSON.stringify(titulo)}, font: { size: 18 } },
        datalabels: {
          anchor: 'end', align: 'end', clamp: true, color: '#222', font: { weight: 'bold', size: 12 },
          formatter: ${formatterRotulo(total, percentual)}
        }
      },
      scales: { x: { beginAtZero: true, grace: '48%', ticks: { callback: function(v) { return 'R$ ' + v; } } } }
    }
  }`;

  return `${BASE}?v=4&w=720&h=${altura}&bkg=white&c=${encodeURIComponent(config)}`;
}
