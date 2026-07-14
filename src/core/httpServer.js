import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config/env.js';
import * as notificationService from './notification.service.js';

// Compara o token recebido com o esperado em tempo constante.
function tokenValido(recebido) {
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(config.cronToken);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Sobe um servidor HTTP mínimo: keep-alive (/cron) e notificações (/cron/notificar).
export function iniciarServidorHttp() {
  const servidor = http.createServer(async (req, res) => {
    const rota = new URL(req.url, `http://${req.headers.host}`).pathname;

    if (req.method !== 'GET' || (rota !== '/cron' && rota !== '/cron/notificar')) {
      res.writeHead(404).end('not found');
      return;
    }

    if (!tokenValido(req.headers['x-cron-token'])) {
      res.writeHead(401).end('unauthorized');
      return;
    }

    try {
      if (rota === '/cron/notificar') {
        const resultado = await notificationService.notificarVencimentosDeHoje();
        res.writeHead(200).end(JSON.stringify(resultado));
      } else {
        await notificationService.manterVivo();
        res.writeHead(200).end('ok');
      }
    } catch (err) {
      console.error('[cron] Erro ao processar a rota:', err);
      res.writeHead(500).end('error');
    }
  });

  servidor.listen(config.port, () => {
    console.log(`🌐 Servidor HTTP (keep-alive) na porta ${config.port}`);
  });

  return servidor;
}
