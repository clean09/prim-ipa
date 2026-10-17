// Seite „PRIMFALL“: das Roguelike im Vollbild (ohne Kopf- und Tab-Leiste).
import { go, immersive, setBusy } from '../core/nav';
import { h } from '../ui/dom';
import { Game } from '../rogue/game';
import '../rogue/rogue.css';

export function mountRogue(root: HTMLElement) {
  const stage = h('div', { class: 'stage rg-stage' });
  root.append(stage);
  immersive(true);
  setBusy(false);
  const game = new Game(stage, () => go('games'));
  return () => { game.dispose(); immersive(false); };
}
