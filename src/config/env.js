import dotenv from 'dotenv';

dotenv.config();

// Lê uma variável obrigatória; aborta o boot se estiver ausente ou vazia.
function obrigatoria(chave) {
  const valor = process.env[chave];
  if (!valor || valor.trim() === '') {
    throw new Error(
      `[CONFIG] Variável de ambiente obrigatória ausente: "${chave}". ` +
        `Confira seu arquivo .env (use o .env.example como base).`
    );
  }
  return valor.trim();
}

// Lê uma variável opcional, retornando o padrão quando ausente.
function opcional(chave, padrao = '') {
  const valor = process.env[chave];
  return valor && valor.trim() !== '' ? valor.trim() : padrao;
}

const nodeEnv = opcional('NODE_ENV', 'development');

// Config central da aplicação.
export const config = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === 'production',

  botToken: obrigatoria('BOT_TOKEN'),
  telegramUserId: Number(obrigatoria('TELEGRAM_USER_ID')),

  supabaseUrl: obrigatoria('SUPABASE_URL'),
  supabaseServiceRoleKey: obrigatoria('SUPABASE_SERVICE_ROLE_KEY'),
  webhookDomain: opcional('WEBHOOK_DOMAIN'),
  port: Number(opcional('PORT', '3000')),
  cronToken: obrigatoria('CRON_TOKEN'),
});

if (Number.isNaN(config.telegramUserId)) {
  throw new Error('[CONFIG] TELEGRAM_USER_ID precisa ser um número válido.');
}
