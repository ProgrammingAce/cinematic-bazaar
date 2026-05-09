import '../games/index';
import { UIManager } from '../framework/client/ui/manager';

const root = document.getElementById('app');
if (!root) throw new Error('No #app element');

const ui = new UIManager(root);
ui.start();
