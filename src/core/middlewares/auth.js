import { config } from '../../config/env.js';

// Bloqueia qualquer update que não venha do dono (TELEGRAM_USER_ID).
export async function auth(ctx, next) {
  const idRemetente = ctx.from?.id;

  if (idRemetente !== config.telegramUserId) {
    console.warn(
      `[AUTH] Acesso negado. ID: ${idRemetente ?? 'desconhecido'} ` +
        `(@${ctx.from?.username ?? 'sem_username'})`
    );
    return;
  }

  return next();
}
