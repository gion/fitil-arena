import type { Link } from './client.ts';

export interface LagOpts {
  /** Latența dus-întors de bază (ms). */
  rtt: number;
  /** Variație aleatoare adăugată pe fiecare sens (ms). */
  jitter: number;
  /** Probabilitatea ca un mesaj să fie „pierdut” și retrimis (TCP), 0–1. */
  loss: number;
}

/** Citește simulatorul de latență din URL: `?lag=150&jitter=40&loss=0.02` (D-033). */
export function lagFromQuery(search: string): LagOpts | null {
  const q = new URLSearchParams(search);
  const rtt = Number(q.get('lag'));
  if (!rtt || rtt < 0) return null;
  return {
    rtt,
    jitter: Math.max(0, Number(q.get('jitter') ?? rtt / 4) || 0),
    loss: Math.min(0.5, Math.max(0, Number(q.get('loss') ?? 0.02) || 0)),
  };
}

/**
 * Simulator de latență peste o legătură: fiecare mesaj (în ambele sensuri) întârzie rtt/2 + jitter,
 * iar cele „pierdute” mai așteaptă o retransmisie. Ordinea se păstrează, ca pe TCP (D-033).
 */
export function lagLink(inner: Link, o: LagOpts, now: () => number = () => performance.now()): Link {
  const delay = () => {
    let d = o.rtt / 2 + Math.random() * o.jitter;
    if (Math.random() < o.loss) d += Math.max(200, o.rtt);
    return d;
  };
  // o singură coadă pe sens, cu un singur timer: două timere cu același termen nu au ordine garantată
  const queue = () => {
    const q: { at: number; fn: () => void }[] = [];
    let armed = false;
    const pump = () => {
      armed = false;
      while (q.length && q[0]!.at <= now()) q.shift()!.fn();
      if (q.length) arm();
    };
    const arm = () => {
      armed = true;
      setTimeout(pump, Math.max(0, q[0]!.at - now()));
    };
    return (fn: () => void) => {
      q.push({ at: Math.max(q.at(-1)?.at ?? 0, now() + delay()), fn });
      if (!armed) arm();
    };
  };
  const up = queue();
  const down = queue();
  return {
    send: (type, msg) => up(() => inner.send(type, msg)),
    on: (type, fn) => inner.on(type, (msg) => down(() => fn(msg))),
  };
}
