import { Telegraf } from 'telegraf';
import { config } from '../config/env.js';

// Instância única do Telegraf, compartilhada por todo o app.
export const bot = new Telegraf(config.botToken);
