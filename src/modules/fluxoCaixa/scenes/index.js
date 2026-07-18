import { gastoScene, receitaScene } from './movimentacao.scene.js';
import { pagarContaScene } from './pagarConta.scene.js';
import { editarLancamentoScene } from './editar.scene.js';

// Reúne todas as scenes (wizards) do módulo Fluxo de Caixa.
export const fluxoCaixaScenes = [gastoScene, receitaScene, pagarContaScene, editarLancamentoScene];
