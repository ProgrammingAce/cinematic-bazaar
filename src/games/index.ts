import { registerClientGame } from '../framework/client/ui/manager';
import tetrominoGame from './tetromino/definition';

registerClientGame(tetrominoGame as any);
