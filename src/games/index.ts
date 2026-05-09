import { registerClientGame } from '../framework/client/ui/manager';
import { GAMES } from './registry';

for (const game of GAMES) registerClientGame(game);
