import { Scenes } from 'telegraf';
import { bancosScenes } from '../modules/bancos/bancos.scenes.js';

// Stage central: reúne as scenes (wizards) de todos os módulos.
const scenes = [...bancosScenes];

export const stage = new Scenes.Stage(scenes);
