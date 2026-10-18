// Alle Ereignisse von STERNENFALL. Neue Ereignisse: in events_a/b.ts anhängen (oder eine neue Liste hier einhängen).
import { EventDef } from '../types';
import { EVENTS_A } from './events_a';
import { EVENTS_B } from './events_b';
import { EVENTS_C } from './events_c';

export const EVENTS: EventDef[] = [...EVENTS_A, ...EVENTS_B, ...EVENTS_C];
