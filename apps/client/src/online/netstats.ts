/**
 * Măsurătorile rețelei într-un meci online: ping (RTT, la 2s), resincronizări, căderi de conexiune.
 * Se văd în HUD cu „Network stats” (sau `?net=1`) și pleacă în `match_end` (testele cu oameni reali).
 */
export class NetStats {
  /** Ultimul ping, în ms (0 = încă nemăsurat). */
  rtt = 0;
  drops = 0;
  private samples: number[] = [];

  add(ms: number): void {
    this.rtt = Math.round(ms);
    this.samples.push(this.rtt);
    // ~20 de minute la un ping la 2s
    if (this.samples.length > 600) this.samples.shift();
  }

  reset(): void {
    this.samples = [];
    this.drops = 0;
  }

  summary(): { ping_avg: number; ping_p95: number; ping_max: number; ping_n: number } {
    const s = [...this.samples].sort((a, b) => a - b);
    const n = s.length;
    if (!n) return { ping_avg: 0, ping_p95: 0, ping_max: 0, ping_n: 0 };
    return {
      ping_avg: Math.round(s.reduce((a, b) => a + b, 0) / n),
      ping_p95: s[Math.min(n - 1, Math.floor(n * 0.95))]!,
      ping_max: s[n - 1]!,
      ping_n: n,
    };
  }
}
