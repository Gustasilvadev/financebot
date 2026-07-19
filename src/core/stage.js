import { Scenes } from 'telegraf';
import { bancosScenes } from '../modules/bancos/bancos.scenes.js';
import { fluxoCaixaScenes } from '../modules/fluxoCaixa/scenes/index.js';
import { emprestimosScenes } from '../modules/emprestimos/emprestimos.scenes.js';
import { orcamentosScenes } from '../modules/orcamentos/orcamentos.scenes.js';

// Stage central: reúne as scenes (wizards) de todos os módulos.
const scenes = [...bancosScenes, ...fluxoCaixaScenes, ...emprestimosScenes, ...orcamentosScenes];

export const stage = new Scenes.Stage(scenes);
