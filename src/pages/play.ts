// Spielseite im Vollbild: startet das im Hub gewählte Spiel (ohne Kopf- und Tab-Leiste).
import { go, immersive, setBusy } from '../core/nav';
import { h } from '../ui/dom';
import { BubbleMode, runBubbles } from '../games/bubbles';
import { runPiGame } from '../games/pigame';
import { GameId } from '../games/progress';
import { runSlicer } from '../games/slicer';

let pending: GameId = 'classic';
/** Spiel auswählen und starten (vom Hub aus). */
export function launch(id: GameId) { pending = id; go('play'); }

export function mountPlay(root: HTMLElement) {
  const stage = h('div', { class: 'stage', style: { background: '#03050a' } });
  root.append(stage);
  immersive(true);
  setBusy(false);
  let cleanup: (() => void) | null = null;
  const exit = () => go('games');
  const start = (id: GameId) => {
    cleanup?.();
    if (id === 'split') cleanup = runSlicer(stage, exit, () => start('split'));
    else if (id === 'pi') cleanup = runPiGame(stage, exit, () => start('pi'));
    else cleanup = runBubbles(stage, id as BubbleMode, exit, m => start(m));
  };
  start(pending);
  return () => { cleanup?.(); immersive(false); };
}
