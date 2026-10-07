import * as THREE from 'three';
import { HARD, HOME, SOFT, TICK_HZ, U, canSee, idx, inBounds, targetAt, walkable } from '@fitil/sim';
import type { Dir, GameState } from '@fitil/sim';
import { TEAMS, charById } from '@fitil/content';
import { FRIEND_COL } from '../render/colors.ts';
import type { Theme } from '@fitil/content';
import type { Match, MatchEvent } from '../game/match.ts';
import * as paint from '../render/paint.ts';
import { SPECIAL_COLOR } from '../render/paint.ts';
import type { Quality, View } from '../settings.ts';
import { settings } from '../settings.ts';

/** Three r155+ folosește unități fizice: intensitățile din prototip (r128) × π dau aceeași lumină. */
const LEGACY = Math.PI;
const DX = [0, 0, -1, 1];
const DY = [-1, 1, 0, 0];
const CROSS: [number, number][] = [
  [0, 0],
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

/** Direcția pe grilă cea mai apropiată de unghiul camerei. */
export function yawDir(yaw: number): Dir {
  const x = Math.sin(yaw);
  const z = Math.cos(yaw);
  return Math.abs(x) > Math.abs(z) ? (x > 0 ? 3 : 2) : z > 0 ? 1 : 0;
}

function canvasTex(
  w: number,
  h: number,
  draw: (c: CanvasRenderingContext2D) => void,
  repeat = false,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const std = (o: THREE.MeshStandardMaterialParameters) =>
  new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });

interface Inst {
  mesh: THREE.InstancedMesh;
  n: number;
}

/**
 * Vederile 3D (1P / 3P): un renderer separat care citește aceeași stare ca rendererul 2D.
 * Texturile vin din aceleași desene procedurale ale temei.
 */
export class Renderer3D {
  private r: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(72, 1, 0.04, 200);
  private hemi = new THREE.HemisphereLight(0xdfefff, 0x3a3326, 0.55);
  private sun = new THREE.DirectionalLight(0xfff0d8, 1.25);
  private expLights: { l: THREE.PointLight; t: number }[] = [];
  private match: Match | null = null;
  private view: View = 'chase';
  private built: GameState | null = null;
  private builtTheme = '';
  private root = new THREE.Group();
  private inst: Record<string, Inst> = {};
  private bombPool: THREE.Group[] = [];
  private players: THREE.Group[] = [];
  private pads: THREE.Object3D[] = [];
  private spiders: THREE.Group[] = [];
  private clouds: THREE.Group[] = [];
  private bolts: THREE.Mesh[] = [];
  private flags: THREE.Group[] = [];
  private vm: THREE.Group | null = null;
  private tmp = new THREE.Object3D();
  private col = new THREE.Color();
  private texCache = new Map<string, THREE.Texture>();
  private yaw = 0;
  private camInit = false;
  private held: Dir | null = null;
  private shake = 0;
  private flash = 0;
  private strikes: { x: number; y: number; t: number }[] = [];
  private vmKick = 0;
  private walk = new Map<number, number>();
  private hardCount = -1;
  private padKey = '';
  private cineDir: [number, number] | null = null;
  private time = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private theme: Theme,
    private quality: Quality,
  ) {
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.r.toneMapping = THREE.ACESFilmicToneMapping;
    this.r.toneMappingExposure = 1.1;
    this.r.shadowMap.type = THREE.PCFShadowMap;
    this.scene.add(this.cam, this.hemi, this.sun, this.sun.target, this.root);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffa04a, 0, 6, 2);
      this.scene.add(l);
      this.expLights.push({ l, t: 9 });
    }
    this.setQuality(quality);
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  setQuality(q: Quality): void {
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    this.r.setPixelRatio(
      q === 'low' ? Math.min(1, dpr) : q === 'medium' ? Math.min(1.5, dpr) : Math.min(2, dpr),
    );
    this.r.shadowMap.enabled = q !== 'low';
    this.sun.castShadow = q !== 'low';
    const size = q === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    this.resize();
    this.built = null;
  }

  setTheme(t: Theme): void {
    this.theme = t;
    this.built = null;
  }

  setMatch(m: Match | null): void {
    this.match = m;
    this.built = null;
    this.camInit = false;
    this.walk.clear();
    this.strikes = [];
    m?.on((e) => this.onEvent(e));
  }

  setView(v: View): void {
    this.view = v;
    this.camInit = false;
    this.resize();
  }

  private resize(): void {
    const w = innerWidth;
    const h = innerHeight;
    this.r.setSize(w, h, false);
    this.cam.aspect = w / Math.max(1, h);
    this.cam.updateProjectionMatrix();
  }

  kick(): void {
    this.vmKick = 1;
  }

  /** Glisare pe dreapta (pixeli CSS) și săgeți stânga/dreapta = rotirea camerei. */
  look(dx: number, turn: number, dtMs: number): void {
    this.yaw -= dx * 0.0085;
    if (turn) this.yaw -= turn * 2.6 * (dtMs / 1000);
  }

  /** Unghiul camerei (radiani), pentru săgeata de obiectiv. */
  get yawAngle(): number {
    return this.yaw;
  }

  faceDir(): Dir {
    return yawDir(this.yaw);
  }

  /**
   * Mers relativ la cameră: [înainte, dreapta] → direcția pe grilă, cu histerezis (fără tremurat la 45°)
   * și asistență (dacă direcția principală e blocată și împingi ușor lateral, o ia pe cea liberă).
   */
  inputDir(v: [number, number] | null): Dir | null {
    const m = this.match;
    if (!v || !m) {
      this.held = null;
      return null;
    }
    const [f, rt] = v;
    const dx = Math.sin(this.yaw);
    const dz = Math.cos(this.yaw);
    const wx = dx * f - dz * rt;
    const wz = dz * f + dx * rt;
    const p = m.me;
    const cx = Math.round(p.px / U);
    const cy = Math.round(p.py / U);
    const free = (d: Dir) => walkable(m.s, cx + DX[d]!, cy + DY[d]!);
    const held = this.held;
    if (held !== null && !(!p.moving && !free(held))) {
      const hx = DX[held]!;
      const hz = DY[held]!;
      if (hx && Math.sign(wx) === hx && Math.abs(wx) * 1.3 > Math.abs(wz)) return held;
      if (hz && Math.sign(wz) === hz && Math.abs(wz) * 1.3 > Math.abs(wx)) return held;
    }
    const ax: Dir = wx > 0 ? 3 : 2;
    const az: Dir = wz > 0 ? 1 : 0;
    const xMain = Math.abs(wx) > Math.abs(wz);
    let d = xMain ? ax : az;
    const alt = xMain ? az : ax;
    const altW = xMain ? Math.abs(wz) : Math.abs(wx);
    if (!p.moving && altW > 0.25 && !free(d) && free(alt)) d = alt;
    this.held = d;
    return d;
  }

  private onEvent(e: MatchEvent): void {
    const m = this.match;
    if (!m) return;
    if (e.type === 'explode') {
      let best = this.expLights[0]!;
      for (const x of this.expLights) if (x.t > best.t) best = x;
      best.t = 0;
      best.l.position.set(e.x, 0.8, e.y);
      best.l.color.set(this.theme.flame[1]);
      const me = m.me;
      const d = Math.hypot(me.px / U - e.x, me.py / U - e.y);
      this.shake = Math.min(1.6, this.shake + Math.max(0.12, 1.15 - d / 5) * (0.7 + e.range * 0.12));
    }
    if (e.type === 'strike') {
      this.strikes.push({ x: e.x, y: e.y, t: 0.18 });
      this.flash = 0.7;
      this.shake = Math.min(1.6, this.shake + 0.5);
    }
  }

  /* ---------- texturi ---------- */

  private tileTex(kind: 'ground' | 'hard' | 'soft'): THREE.Texture {
    const key = this.theme.id + kind;
    const hit = this.texCache.get(key);
    if (hit) return hit;
    const S = 128;
    const n = kind === 'ground' ? 2 : 1;
    const st = this.theme.style;
    const t = canvasTex(
      S * n,
      S * n,
      (c) =>
        paint.withCtx(c, S, () => {
          for (let y = 0; y < n; y++)
            for (let x = 0; x < n; x++) {
              const px = x * S;
              const py = y * S;
              if (kind === 'ground') paint.ground(st, x + 3, y + 3, px, py);
              else if (kind === 'hard') {
                c.fillStyle = this.theme.c3.hard;
                c.fillRect(px, py, S, S);
                paint.hard(st, x + 5, y + 5, px, py);
              } else {
                c.fillStyle = this.theme.debris[1];
                c.fillRect(px, py, S, S);
                paint.soft(st, x + 7, y + 7, px, py);
              }
            }
        }),
      kind === 'ground',
    );
    this.texCache.set(key, t);
    return t;
  }

  private fireTex(): THREE.Texture {
    const key = this.theme.id + 'fire';
    const hit = this.texCache.get(key);
    if (hit) return hit;
    const [c1, c2, c3] = this.theme.flame;
    const t = canvasTex(64, 128, (g) => {
      const w = 64;
      const h = 128;
      const gr = g.createRadialGradient(w / 2, h * 0.72, 2, w / 2, h * 0.6, h * 0.55);
      gr.addColorStop(0, c3);
      gr.addColorStop(0.28, c2);
      gr.addColorStop(0.6, c1);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(w * 0.5, 2);
      g.bezierCurveTo(w * 0.95, h * 0.35, w, h * 0.8, w * 0.5, h - 2);
      g.bezierCurveTo(0, h * 0.8, w * 0.05, h * 0.35, w * 0.5, 2);
      g.fill();
    });
    this.texCache.set(key, t);
    return t;
  }

  private glowTex(): THREE.Texture {
    const hit = this.texCache.get('glow');
    if (hit) return hit;
    const t = canvasTex(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.3, 'rgba(255,240,180,.8)');
      gr.addColorStop(1, 'rgba(255,160,40,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    });
    this.texCache.set('glow', t);
    return t;
  }

  /* ---------- construcție ---------- */

  private clear(): void {
    const dispose = (o: THREE.Object3D) =>
      o.traverse((c) => {
        const mesh = c as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
    dispose(this.root);
    this.root.clear();
    if (this.vm) {
      this.cam.remove(this.vm);
      dispose(this.vm);
      this.vm = null;
    }
    this.inst = {};
    this.bombPool = [];
    this.players = [];
    this.pads = [];
    this.spiders = [];
    this.clouds = [];
    this.bolts = [];
    this.flags = [];
    this.mis = null;
    this.hardCount = -1;
    this.padKey = '';
    if (this.builtTheme !== this.theme.id) {
      for (const t of this.texCache.values()) t.dispose();
      this.texCache.clear();
    }
  }

  private makeBomb(glowMat: THREE.SpriteMaterial): THREE.Group {
    const st = this.theme.style;
    const g = new THREE.Group();
    const cube = st === 'cube';
    const soft3 = st === 'jungle' || st === 'school' || st === 'valentine';
    const bodyMat = std({
      color: this.theme.c3.bomb,
      roughness: st === 'jungle' ? 0.8 : soft3 ? 0.4 : st === 'xmas' ? 0.18 : 0.32,
      metalness: soft3 ? 0.05 : st === 'xmas' ? 0.7 : 0.45,
      emissive: '#ff2020',
      emissiveIntensity: 0,
    });
    const body = new THREE.Mesh(
      cube ? new THREE.BoxGeometry(0.62, 0.62, 0.62) : new THREE.SphereGeometry(0.37, 28, 20),
      bodyMat,
    );
    body.position.y = 0.37;
    body.castShadow = true;
    g.add(body);
    if (st === 'neon') {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.38, 0.03, 8, 32),
        new THREE.MeshBasicMaterial({ color: '#29f0ff' }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.37;
      g.add(ring);
    }
    if (st === 'xmas') {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.372, 0.035, 8, 40),
        std({ color: '#ffffff', roughness: 0.3 }),
      );
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.37;
      g.add(band);
    }
    if (st === 'school') {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), std({ color: '#3faa3a' }));
      leaf.scale.set(1.3, 0.35, 0.7);
      leaf.position.set(-0.13, 0.78, 0);
      leaf.rotation.z = 0.5;
      g.add(leaf);
      body.scale.set(1.08, 0.95, 1.08);
    }
    if (st === 'halloween') {
      const fm = new THREE.MeshBasicMaterial({ color: '#ff9a1a' });
      for (const sd of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 3), fm);
        e.position.set(sd * 0.12, 0.45, 0.34);
        e.rotation.x = Math.PI / 2;
        g.add(e);
      }
      const mo = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 16, Math.PI), fm);
      mo.position.set(0, 0.3, 0.33);
      mo.rotation.z = Math.PI;
      g.add(mo);
    }
    if (st === 'valentine') body.scale.set(1.1, 0.95, 0.85);
    if (st === 'cosmos')
      for (let i = 0; i < 6; i++) {
        const sp = new THREE.Mesh(
          new THREE.ConeGeometry(0.06, 0.18, 8),
          std({ color: '#8d97b5', metalness: 0.7, roughness: 0.3 }),
        );
        const a = (i / 6) * Math.PI * 2;
        sp.position.set(Math.cos(a) * 0.4, 0.37, Math.sin(a) * 0.4);
        sp.rotation.z = (-Math.cos(a) * Math.PI) / 2;
        sp.rotation.x = (Math.sin(a) * Math.PI) / 2;
        g.add(sp);
      }
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 0.1, 16),
      std({ color: '#8a8f9c', metalness: 0.85, roughness: 0.25 }),
    );
    cap.position.y = cube ? 0.72 : 0.75;
    g.add(cap);
    const cy = cap.position.y;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, cy, 0),
      new THREE.Vector3(0.04, cy + 0.12, 0.02),
      new THREE.Vector3(0.14, cy + 0.17, 0.05),
      new THREE.Vector3(0.2, cy + 0.13, 0.07),
    ]);
    g.add(
      new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.022, 6), std({ color: '#c8a26a', roughness: 0.9 })),
    );
    const spark = new THREE.Sprite(glowMat);
    spark.position.set(0.2, cy + 0.14, 0.07);
    spark.scale.setScalar(0.34);
    spark.name = 'spark';
    g.add(spark);
    const ant = new THREE.Group();
    ant.name = 'ant';
    ant.visible = false;
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6),
      std({ color: '#cfd3e6', metalness: 0.8 }),
    );
    rod.position.set(-0.2, 0.8, 0);
    ant.add(rod);
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 10, 8),
      new THREE.MeshBasicMaterial({ color: '#ff3b3b' }),
    );
    led.position.set(-0.2, 0.96, 0);
    led.name = 'led';
    ant.add(led);
    g.add(ant);
    g.userData.body = bodyMat;
    return g;
  }

  private build(s: GameState): void {
    this.clear();
    const th = this.theme;
    const st = th.style;
    const neon = st === 'neon';
    const dark = neon || st === 'cosmos' || st === 'halloween';
    const N = s.W * s.H;
    this.scene.background = new THREE.Color(th.c3.sky);
    this.scene.fog = new THREE.Fog(th.c3.sky, 9, Math.max(s.W, s.H) * 1.6);
    this.hemi.intensity = (dark ? 0.35 : 0.6) * LEGACY;
    this.sun.intensity = (dark ? 0.55 : 1.25) * LEGACY;
    this.r.toneMappingExposure = dark ? 1.3 : 1.1;
    const gt = this.tileTex('ground');
    const inf = s.inf !== null;
    if (inf) gt.repeat.set(40, 40);
    else gt.repeat.set(s.W / 2, s.H / 2);
    const ground = new THREE.Mesh(
      inf ? new THREE.PlaneGeometry(80, 80) : new THREE.PlaneGeometry(s.W, s.H),
      std({ map: gt, roughness: 0.95 }),
    );
    ground.name = 'ground';
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(s.W / 2 - 0.5, 0, s.H / 2 - 0.5);
    ground.receiveShadow = true;
    this.root.add(ground);
    const inst = (name: string, geo: THREE.BufferGeometry, mat: THREE.Material, shadow = false) => {
      const m = new THREE.InstancedMesh(geo, mat, N);
      m.count = 0;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // instanțele se mută în fiecare cadru, iar sfera de încadrare se calculează o singură dată (goală,
      // cu count 0): cu culling-ul pornit, flăcările se desenau doar când originea lumii era în cadru
      m.frustumCulled = false;
      if (shadow) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
      this.root.add(m);
      this.inst[name] = { mesh: m, n: 0 };
    };
    const ht = this.tileTex('hard');
    const stt = this.tileTex('soft');
    inst(
      'hard',
      new THREE.BoxGeometry(1, 1, 1),
      std({
        map: ht,
        emissive: neon ? '#ffffff' : '#000000',
        emissiveMap: neon ? ht : null,
        emissiveIntensity: neon ? 0.55 : 0,
        roughness: 0.8,
      }),
      true,
    );
    inst(
      'soft',
      new THREE.BoxGeometry(0.9, 0.8, 0.9),
      std({
        map: stt,
        emissive: neon ? '#ffffff' : '#000000',
        emissiveMap: neon ? stt : null,
        emissiveIntensity: neon ? 0.45 : 0,
        roughness: 0.9,
      }),
      true,
    );
    inst(
      'softCursed',
      new THREE.BoxGeometry(0.9, 0.8, 0.9),
      std({ map: stt, color: '#8a3ad0', emissive: '#6a1fb0', emissiveIntensity: 0.45, roughness: 0.6 }),
      true,
    );
    inst(
      'softGold',
      new THREE.BoxGeometry(0.9, 0.8, 0.9),
      std({
        map: stt,
        color: '#ffd23f',
        emissive: '#ffb000',
        emissiveIntensity: 0.35,
        metalness: 0.5,
        roughness: 0.35,
      }),
      true,
    );
    const fm = new THREE.MeshBasicMaterial({
      map: this.fireTex(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const pa = new THREE.PlaneGeometry(1.15, 1.4);
    pa.translate(0, 0.7, 0);
    const pb = pa.clone();
    pb.rotateY(Math.PI / 2);
    inst('fa', pa, fm);
    inst('fb', pb, fm);
    const pg = new THREE.PlaneGeometry(1.25, 1.25);
    pg.rotateX(-Math.PI / 2);
    inst(
      'fg',
      pg,
      new THREE.MeshBasicMaterial({
        map: this.glowTex(),
        color: th.flame[1],
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    inst(
      'item',
      new THREE.BoxGeometry(0.42, 0.42, 0.42),
      std({ color: '#ffffff', emissive: '#333333', roughness: 0.35, metalness: 0.2 }),
      true,
    );
    const im = this.inst.item!.mesh;
    for (let i = 0; i < N; i++) im.setColorAt(i, this.col.set('#ffffff'));
    const zm = new THREE.MeshBasicMaterial({
      color: '#ffec50',
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const zg = new THREE.PlaneGeometry(0.9, 0.9);
    zg.rotateX(-Math.PI / 2);
    inst('zone', zg, zm);
    // Faza 4: tufișuri și nor toxic
    inst(
      'bush',
      new THREE.ConeGeometry(0.5, 1, 7, 1, true),
      std({ color: '#8fc94a', roughness: 0.9, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
      true,
    );
    const tg = new THREE.PlaneGeometry(1, 1);
    tg.rotateX(-Math.PI / 2);
    inst(
      'toxic',
      tg,
      new THREE.MeshBasicMaterial({ color: '#8dff5a', transparent: true, opacity: 0.35, depthWrite: false }),
    );
    const sg = new THREE.PlaneGeometry(1, 1);
    sg.rotateX(-Math.PI / 2);
    inst(
      'shift',
      sg,
      new THREE.MeshBasicMaterial({ color: '#ff3c3c', transparent: true, opacity: 0.3, depthWrite: false }),
    );
    const glowMat = new THREE.SpriteMaterial({
      map: this.glowTex(),
      color: '#ffd23f',
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    for (let i = 0; i < 40; i++) {
      const b = this.makeBomb(glowMat);
      b.visible = false;
      this.root.add(b);
      this.bombPool.push(b);
    }
    this.buildPlayers(s);
    if (s.ctf) this.buildFlags(s);
    if (inf) this.scene.fog = new THREE.Fog(th.c3.sky, 9, 22);
    if (s.mission) this.buildMission(s);
    const R = inf ? 20 : Math.max(s.W, s.H) * 0.8;
    this.sun.position.set(s.W / 2 + 5, 15, s.H / 2 + 7);
    this.sun.target.position.set(s.W / 2 - 0.5, 0, s.H / 2 - 0.5);
    const sc = this.sun.shadow.camera;
    sc.left = -R;
    sc.right = R;
    sc.top = R;
    sc.bottom = -R;
    sc.near = 1;
    sc.far = 60;
    sc.updateProjectionMatrix();
    // mâna cu bomba (persoana întâi)
    const vm = new THREE.Group();
    const vb = this.makeBomb(glowMat);
    vb.scale.setScalar(0.34);
    vb.name = 'vb';
    vm.add(vb);
    const glove = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 18, 14),
      std({ color: this.pcolor(0), roughness: 0.6 }),
    );
    glove.scale.set(1.2, 0.8, 1.1);
    glove.position.set(0, 0.04, 0.02);
    vm.add(glove);
    vm.position.set(0.4, -0.34, -0.8);
    vm.rotation.set(0.15, -0.35, 0);
    this.cam.add(vm);
    this.vm = vm;
    // tot ce apare abia în timpul meciului (păianjeni, nori, fulgere) se creează ascuns de acum
    this.addSpider();
    this.addCloud();
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6),
        new THREE.MeshBasicMaterial({ color: '#f4fbff' }),
      );
      b.visible = false;
      this.root.add(b);
      this.bolts.push(b);
    }
    this.warm(s);
    this.built = s;
    this.builtTheme = th.id;
    this.camInit = false;
  }

  /**
   * Un cadru de încălzire, cu tot ce e ascuns făcut vizibil: shaderele se compilează (și driverul își
   * pregătește starea) acum, la construcție. Altfel prima flacără / primul nor / prima bombă din meci
   * îngheață un cadru (zeci de ms pe desktop, sute pe telefon). Cadrul real se desenează imediat peste.
   */
  private warm(s: GameState): void {
    const hidden: THREE.Object3D[] = [];
    this.scene.traverse((o) => {
      if (o.visible) return;
      hidden.push(o);
      o.visible = true;
    });
    const counts = Object.values(this.inst).map((i) => i.mesh.count);
    for (const i of Object.values(this.inst)) i.mesh.count = 1;
    const cam = this.cam;
    const pos = cam.position.clone();
    const quat = cam.quaternion.clone();
    const fov = cam.fov;
    // de sus, cu unghi larg: încap și arena, și obiectele din rezervă (încă în origine)
    cam.fov = 90;
    cam.position.set(s.W / 2, 80, s.H / 2 + 1);
    cam.lookAt(s.W / 2, 0, s.H / 2);
    cam.updateProjectionMatrix();
    this.r.render(this.scene, cam);
    cam.fov = fov;
    cam.position.copy(pos);
    cam.quaternion.copy(quat);
    cam.updateProjectionMatrix();
    Object.values(this.inst).forEach((i, k) => (i.mesh.count = counts[k]!));
    for (const o of hidden) o.visible = false;
  }

  private pcolor(id: number): string {
    const c = this.match?.slots[id]?.color ?? '#ffffff';
    if (c === 'rainbow') return '#ff5a5a';
    return this.theme.tint[c] ?? c;
  }

  /** Detaliile personajului și pălăria cumpărată (versiuni simple ale desenelor 2D). */
  private charBits(grp: THREE.Group, ch: string | null, hatId: string | null): void {
    const m = (geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number) => {
      const o = new THREE.Mesh(geo, std({ color }));
      o.position.set(x, y, z);
      o.castShadow = true;
      grp.add(o);
      return o;
    };
    if (ch === 'gugu') m(new THREE.BoxGeometry(0.32, 0.06, 0.06), '#2b1d12', 0, 0.36, 0.33).rotation.x = 0.3;
    if (ch === 'zuzu')
      m(new THREE.TorusGeometry(0.33, 0.035, 8, 24), '#e0302f', 0, 0.58, 0).rotation.x = Math.PI / 2;
    if (ch === 'striker')
      m(new THREE.TorusGeometry(0.33, 0.035, 8, 24), '#ffffff', 0, 0.6, 0).rotation.x = Math.PI / 2;
    if (ch === 'fifi')
      for (const sd of [-1, 1])
        m(new THREE.ConeGeometry(0.08, 0.16, 10), '#ff5fa8', 0.2 + sd * 0.09, 0.74, 0).rotation.z =
          (sd * Math.PI) / 2;
    if (ch === 'veta') {
      const sc = m(
        new THREE.SphereGeometry(0.36, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        '#d8306a',
        0,
        0.44,
        -0.02,
      );
      sc.scale.set(1.02, 1.05, 1.02);
      m(new THREE.BoxGeometry(0.18, 0.16, 0.08), '#8a4a22', 0.36, 0.25, 0);
    }
    if (ch === 'maestru') {
      for (const sd of [-1, 1]) m(new THREE.SphereGeometry(0.12, 10, 8), '#f4f4f8', sd * 0.3, 0.55, -0.05);
      m(new THREE.SphereGeometry(0.1, 10, 8), '#f4f4f8', 0, 0.76, -0.05);
    }
    if (ch === 'robo') {
      m(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 6), '#333333', 0, 0.82, 0);
      m(new THREE.SphereGeometry(0.05, 8, 6), '#ff3b3b', 0, 0.96, 0);
    }
    if (ch === 'chef' && !hatId) {
      m(new THREE.CylinderGeometry(0.2, 0.18, 0.2, 16), '#ffffff', 0, 0.82, 0);
      m(new THREE.SphereGeometry(0.22, 14, 10), '#ffffff', 0, 0.98, 0);
    }
    if (ch === 'magician' && !hatId) {
      m(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 20), '#16161e', 0, 0.72, 0);
      m(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 16), '#16161e', 0, 0.9, 0);
    }
    if (!hatId) return;
    if (hatId === 'h_top') {
      m(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 20), '#16161e', 0, 0.72, 0);
      m(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 16), '#16161e', 0, 0.92, 0);
    } else if (hatId === 'h_crown')
      m(new THREE.CylinderGeometry(0.2, 0.18, 0.18, 8, 1, true), '#ffd23f', 0, 0.8, 0);
    else if (hatId === 'h_cap')
      m(new THREE.SphereGeometry(0.3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#2f6de0', 0, 0.62, 0);
    else if (hatId === 'h_cowboy') {
      m(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 20), '#8a5a2b', 0, 0.72, 0);
      m(new THREE.CylinderGeometry(0.18, 0.22, 0.22, 14), '#8a5a2b', 0, 0.84, 0);
    } else if (hatId === 'h_party') m(new THREE.ConeGeometry(0.16, 0.4, 14), '#ff5fa8', 0, 0.9, 0);
  }

  /** Figurile jucătorilor (doar cele noi: în Infinit apar jucători pe parcurs). */
  private buildPlayers(s: GameState): void {
    const st = this.theme.style;
    const neon = st === 'neon';
    for (const p of s.players.slice(this.players.length)) {
      const grp = new THREE.Group();
      const col = this.pcolor(p.id);
      const slot = this.match?.slots[p.id];
      const ch = slot?.ch ?? null;
      const mat = std({
        color: col,
        roughness: ch === 'robo' ? 0.3 : 0.45,
        metalness: ch === 'robo' ? 0.5 : 0,
        emissive: neon ? col : '#000000',
        emissiveIntensity: neon ? 0.35 : 0,
      });
      if (ch === 'ghost') {
        mat.transparent = true;
        mat.opacity = 0.75;
      }
      const body = new THREE.Mesh(
        ch === 'robo' ? new THREE.BoxGeometry(0.6, 0.6, 0.6) : new THREE.SphereGeometry(0.34, 24, 18),
        mat,
      );
      body.position.y = 0.4;
      body.castShadow = true;
      grp.add(body);
      for (const sd of [-1, 1]) {
        const e = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 12, 10),
          new THREE.MeshBasicMaterial({ color: '#ffffff' }),
        );
        e.position.set(sd * 0.13, 0.5, 0.28);
        grp.add(e);
        const pu = new THREE.Mesh(
          new THREE.SphereGeometry(0.045, 8, 6),
          new THREE.MeshBasicMaterial({ color: '#12131c' }),
        );
        pu.position.set(sd * 0.13, 0.5, 0.36);
        grp.add(pu);
      }
      for (const sd of [-1, 1]) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), std({ color: '#231c1c' }));
        f.scale.set(1, 0.6, 1.4);
        f.position.set(sd * 0.16, 0.07, 0);
        f.name = 'foot' + sd;
        f.castShadow = true;
        grp.add(f);
      }
      this.charBits(grp, ch, slot?.outfit?.hat ?? null);
      if (ch) grp.userData.size = charById(ch).size;
      const hat = new THREE.Group();
      hat.position.y = 0.72;
      // pălăria cumpărată sau a personajului înlocuiește pălăria temei
      if (slot?.outfit?.hat || ch === 'chef' || ch === 'magician') hat.visible = false;
      if (st === 'halloween') {
        const m = std({ color: '#2a1640' });
        hat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 20), m));
        const cn = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 16), m);
        cn.position.set(0.04, 0.22, 0);
        cn.rotation.z = -0.2;
        hat.add(cn);
        const bd = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.05, 16), std({ color: '#ff7a1a' }));
        bd.position.y = 0.04;
        hat.add(bd);
      }
      if (st === 'xmas') {
        const cn = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 16), std({ color: '#d8202a' }));
        cn.position.y = 0.18;
        cn.rotation.z = -0.35;
        hat.add(cn);
        const br = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 20), std({ color: '#ffffff' }));
        br.rotation.x = Math.PI / 2;
        hat.add(br);
        const pm = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), std({ color: '#ffffff' }));
        pm.position.set(0.14, 0.34, 0);
        hat.add(pm);
      }
      if (st === 'valentine')
        for (const sd of [-1, 1]) {
          const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), std({ color: '#ff3d7f' }));
          h2.scale.set(1.2, 1, 0.6);
          h2.position.set(sd * 0.14, 0.18, 0);
          hat.add(h2);
          const s2 = new THREE.Mesh(
            new THREE.CylinderGeometry(0.012, 0.012, 0.18, 5),
            std({ color: '#12131c' }),
          );
          s2.position.set(sd * 0.1, 0.06, 0);
          s2.rotation.z = -sd * 0.4;
          hat.add(s2);
        }
      if (st === 'school') {
        const m = std({ color: '#1c2233' });
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.5), m);
        cap.position.y = 0.1;
        cap.rotation.y = Math.PI / 4;
        hat.add(cap);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.1, 16), m);
        base.position.y = 0.04;
        hat.add(base);
        const ts = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, 0.2, 5),
          std({ color: '#ffd23f' }),
        );
        ts.position.set(0.22, 0.02, 0);
        hat.add(ts);
      }
      if (hat.children.length) {
        hat.traverse((o) => (o.castShadow = true));
        grp.add(hat);
      }
      if (p.id === (this.match?.meId ?? 0)) {
        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(0.4, 0.035, 6, 28),
          new THREE.MeshBasicMaterial({ color: '#ffe14a' }),
        );
        halo.rotation.x = -Math.PI / 2;
        halo.position.y = 0.03;
        halo.name = 'halo';
        grp.add(halo);
      } else if (this.match?.team && p.team === s.players[this.match.meId]!.team) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.38, 0.03, 6, 28),
          new THREE.MeshBasicMaterial({ color: TEAMS[p.team]!.color }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.03;
        grp.add(ring);
      }
      const sh = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 24, 16),
        new THREE.MeshBasicMaterial({
          color: '#4fd8ff',
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        }),
      );
      sh.position.y = 0.4;
      sh.name = 'shield';
      sh.visible = false;
      grp.add(sh);
      // Faza 4: gheață, coroană, cartoful fierbinte
      const ice = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.95, 0.8),
        new THREE.MeshBasicMaterial({ color: '#9fe8ff', transparent: true, opacity: 0.4, depthWrite: false }),
      );
      ice.position.y = 0.45;
      ice.name = 'ice';
      ice.visible = false;
      grp.add(ice);
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.16, 0.16, 6, 1, true),
        std({ color: '#ffd23f', metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide }),
      );
      crown.position.y = 0.86;
      crown.name = 'crown';
      crown.visible = false;
      grp.add(crown);
      const pot = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 18, 14),
        std({ color: '#1a1b26', emissive: '#ff3b3b', emissiveIntensity: 0 }),
      );
      pot.position.y = 1.15;
      pot.name = 'potato';
      pot.visible = false;
      grp.add(pot);
      this.root.add(grp);
      this.players.push(grp);
    }
  }

  private buildFlags(s: GameState): void {
    for (const f of s.ctf!.flags) {
      const col = TEAMS[f.team]!.color;
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6), std({ color: '#222' }));
      pole.position.y = 0.65;
      g.add(pole);
      const cloth = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.32),
        std({ color: col, side: THREE.DoubleSide, emissive: col, emissiveIntensity: 0.3 }),
      );
      cloth.position.set(0.26, 1.12, 0);
      cloth.name = 'cloth';
      g.add(cloth);
      this.root.add(g);
      this.flags.push(g);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.6, 0.05, 8, 32),
        new THREE.MeshBasicMaterial({ color: col }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(f.hx, 0.05, f.hy);
      this.root.add(ring);
    }
  }

  private mis: {
    towers: THREE.Group[];
    cages: THREE.Group[];
    friends: THREE.Mesh[];
    home: THREE.Object3D;
    flag: THREE.Group;
  } | null = null;

  private buildMission(s: GameState): void {
    const mi = s.mission!;
    const tm = std({ color: '#e0402f', roughness: 0.5 });
    const wm = std({ color: '#f3f1ea', roughness: 0.5 });
    const towers = mi.targets
      .filter((t) => t.type === 'tower')
      .map(() => {
        const g = new THREE.Group();
        for (let j = 0; j < 4; j++) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.4, 0.72), j % 2 ? wm : tm);
          b.position.y = 0.2 + j * 0.4;
          b.castShadow = true;
          g.add(b);
        }
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), std({ color: '#333' }));
        pole.position.y = 1.85;
        g.add(pole);
        const fl = new THREE.Mesh(
          new THREE.PlaneGeometry(0.3, 0.18),
          new THREE.MeshBasicMaterial({ color: '#ffd23f', side: THREE.DoubleSide }),
        );
        fl.position.set(0.15, 1.98, 0);
        g.add(fl);
        this.root.add(g);
        return g;
      });
    const cages = mi.targets
      .filter((t) => t.type === 'cage')
      .map((_, i) => {
        const g = new THREE.Group();
        const bars = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.9, 0.9),
          std({ color: '#b9c0d3', wireframe: true }),
        );
        bars.position.y = 0.45;
        g.add(bars);
        const f = new THREE.Mesh(
          new THREE.SphereGeometry(0.25, 16, 12),
          std({ color: FRIEND_COL[i % FRIEND_COL.length]! }),
        );
        f.position.y = 0.3;
        g.add(f);
        this.root.add(g);
        return g;
      });
    const friends = mi.targets
      .filter((t) => t.type === 'cage')
      .map((_, i) => {
        const f = new THREE.Mesh(
          new THREE.SphereGeometry(0.25, 16, 12),
          std({ color: FRIEND_COL[i % FRIEND_COL.length]!, roughness: 0.5 }),
        );
        f.castShadow = true;
        f.visible = false;
        this.root.add(f);
        return f;
      });
    const home = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.05, 8, 32),
      new THREE.MeshBasicMaterial({ color: '#7dffb0' }),
    );
    home.rotation.x = -Math.PI / 2;
    home.position.set(HOME[0], 0.05, HOME[1]);
    this.root.add(home);
    const flag = new THREE.Group();
    const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), std({ color: '#222' }));
    fp.position.y = 0.8;
    flag.add(fp);
    const ff = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.32),
      new THREE.MeshBasicMaterial({
        map: canvasTex(64, 40, (g2) => {
          for (let r = 0; r < 4; r++)
            for (let c = 0; c < 6; c++) {
              g2.fillStyle = (r + c) % 2 ? '#111' : '#fff';
              g2.fillRect(c * 11, r * 10, 11, 10);
            }
        }),
        side: THREE.DoubleSide,
      }),
    );
    ff.position.set(0.27, 1.42, 0);
    flag.add(ff);
    flag.visible = false;
    this.root.add(flag);
    this.mis = { towers, cages, friends, home, flag };
  }

  private renderMission(m: Match): void {
    const mi = m.s.mission!;
    const o = this.mis;
    if (!o) return;
    const towers = mi.targets.filter((t) => t.type === 'tower');
    o.towers.forEach((g, i) => {
      const t = towers[i];
      g.visible = !!t && !t.done;
      if (t && g.visible) g.position.set(t.x, 0, t.y);
    });
    const cages = mi.targets.filter((t) => t.type === 'cage');
    o.cages.forEach((g, i) => {
      const t = cages[i];
      g.visible = !!t && !t.open;
      if (t && g.visible) g.position.set(t.x, 0, t.y);
    });
    o.friends.forEach((f, i) => {
      const fr = mi.friends.find((x) => x.target === mi.targets.indexOf(cages[i]!));
      f.visible = !!fr && !fr.home;
      if (fr && f.visible) {
        const [x, y] = m.lerp(`f${fr.id}`, fr.px, fr.py);
        f.position.set(x, 0.28 + (fr.moving ? Math.abs(Math.sin(this.time * 14)) * 0.06 : 0), y);
        f.scale.set(1, fr.faint > 0 ? 0.6 : 1, 1);
      }
    });
    o.home.visible = mi.def.kind === 'rescue';
    const fl = mi.targets.find((t) => t.type === 'flag');
    o.flag.visible = !!fl && !fl.done;
    if (fl) o.flag.position.set(fl.x, 0, fl.y);
  }

  private refreshPads(s: GameState): void {
    const key = JSON.stringify(s.pads);
    if (key === this.padKey) return;
    this.padKey = key;
    for (const o of this.pads) this.root.remove(o);
    this.pads = [];
    for (const [x, y] of s.pads) {
      const t = new THREE.Mesh(
        new THREE.TorusGeometry(0.36, 0.06, 10, 32),
        new THREE.MeshBasicMaterial({ color: this.theme.portal }),
      );
      t.rotation.x = -Math.PI / 2;
      t.position.set(x, 0.08, y);
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex(),
          color: this.theme.portal,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          opacity: 0.6,
        }),
      );
      sp.scale.set(1, 1.4, 1);
      sp.position.set(x, 0.5, y);
      this.root.add(t, sp);
      this.pads.push(t, sp);
    }
  }

  private set(i: Inst, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0): void {
    const t = this.tmp;
    t.position.set(x, y, z);
    t.scale.set(sx, sy, sz);
    t.rotation.set(0, ry, 0);
    t.updateMatrix();
    i.mesh.setMatrixAt(i.n++, t.matrix);
  }

  /* ---------- randare ---------- */

  render(dtMs: number): void {
    const m = this.match;
    if (!m) {
      this.r.clear();
      return;
    }
    const s = m.s;
    if (this.built !== s || this.builtTheme !== this.theme.id) this.build(s);
    const dt = Math.min(0.05, dtMs / 1000) * (m.paused ? 0 : 1);
    this.time = m.time;
    const time = this.time;
    const I = this.inst;
    for (const k of [
      'soft',
      'softCursed',
      'softGold',
      'fa',
      'fb',
      'fg',
      'item',
      'zone',
      'shift',
      'bush',
      'toxic',
    ])
      I[k]!.n = 0;
    const inf = s.inf !== null;
    // fereastra randată: toată arena sau, în lumea infinită, ±17 pătrățele în jurul jucătorului
    let [rx0, rx1, ry0, ry1] = [0, s.W - 1, 0, s.H - 1];
    if (inf) {
      const [px, py] = m.lerp(`p${m.meId}`, m.me.px, m.me.py);
      const cx = Math.round(px);
      const cy = Math.round(py);
      [rx0, rx1, ry0, ry1] = [cx - 17, cx + 17, cy - 17, cy + 17];
      this.root
        .getObjectByName('ground')
        ?.position.set(Math.round(px / 2) * 2 - 0.5, 0, Math.round(py / 2) * 2 - 0.5);
      this.sun.position.set(px + 5, 15, py + 7);
      this.sun.target.position.set(px, 0, py);
    }
    // pereți (în arenă se schimbă doar la hurry up; în lumea infinită, la fiecare cadru)
    let hc = 0;
    if (!inf) for (const g of s.grid) if (g === HARD) hc++;
    if (inf || hc !== this.hardCount) {
      this.hardCount = hc;
      I.hard!.n = 0;
      for (let y = ry0; y <= ry1; y++)
        for (let x = rx0; x <= rx1; x++)
          if (inBounds(s, x, y) && s.grid[idx(s, x, y)] === HARD) this.set(I.hard!, x, 0.5, y, 1, 1, 1);
      I.hard!.mesh.count = I.hard!.n;
      I.hard!.mesh.instanceMatrix.needsUpdate = true;
    }
    for (let y = ry0; y <= ry1; y++)
      for (let x = rx0; x <= rx1; x++) {
        if (inf && !inBounds(s, x, y)) continue;
        const k = idx(s, x, y);
        const g = s.grid[k];
        const tg = s.mission && g === SOFT ? targetAt(s, x, y) : undefined;
        if (tg && (tg.type === 'tower' || tg.type === 'cage')) continue;
        if (g === SOFT)
          this.set(s.gold[k] ? I.softGold! : s.cursed[k] ? I.softCursed! : I.soft!, x, 0.4, y, 1, 1, 1);
        const f = s.flame[k]!;
        if (f > 0) {
          const a = Math.min(1, f / (0.2 * TICK_HZ));
          const h = a * (0.75 + Math.random() * 0.35);
          const w = 0.85 + a * 0.2;
          const r = Math.random() * 0.4 - 0.2;
          this.set(I.fa!, x, 0, y, w, h, w, r);
          this.set(I.fb!, x, 0, y, w, h, w, r);
          this.set(I.fg!, x, 0.02, y, a, 1, a);
        }
        if (s.bush[k]) this.set(I.bush!, x, 0.45, y, 0.9, 0.9, 0.9);
        if (s.toxic[k]! > 0) this.set(I.toxic!, x, 0.04, y, 1, 1, 1);
        const it = s.items[k];
        if (it && g !== SOFT) {
          const i = I.item!;
          i.mesh.setColorAt(i.n, this.col.set(paint.ITEM_COLOR[it]));
          this.set(i, x, 0.35 + Math.sin(time * 3 + x) * 0.06, y, 1, 1, 1, time * 1.5 + x);
        }
      }
    for (const c of s.clouds)
      if (c.charge >= 0)
        for (const [dx, dy] of CROSS) {
          const x = c.sx + dx;
          const y = c.sy + dy;
          if (!inBounds(s, x, y) || s.grid[idx(s, x, y)] === HARD) continue;
          this.set(I.zone!, x, 0.03, y, 1, 1, 1);
        }
    (I.zone!.mesh.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.3 * Math.abs(Math.sin(time * 16));
    if (s.shift) {
      const sh = s.shift;
      if (sh.axis === 0) for (let x = 1; x < s.W - 1; x++) this.set(I.shift!, x, 0.02, sh.idx, 1, 1, 1);
      else for (let y = 1; y < s.H - 1; y++) this.set(I.shift!, sh.idx, 0.02, y, 1, 1, 1);
      (I.shift!.mesh.material as THREE.MeshBasicMaterial).opacity =
        sh.warn > 0 ? 0.2 + 0.3 * Math.abs(Math.sin(time * 14)) : 0.2;
    }
    for (const k of [
      'soft',
      'softCursed',
      'softGold',
      'fa',
      'fb',
      'fg',
      'item',
      'zone',
      'shift',
      'bush',
      'toxic',
    ]) {
      const i = I[k]!;
      i.mesh.count = i.n;
      i.mesh.instanceMatrix.needsUpdate = true;
      if (i.mesh.instanceColor) i.mesh.instanceColor.needsUpdate = true;
    }
    this.refreshPads(s);
    this.pads.forEach((t, i) => {
      t.visible = !(s.portalT < 2.5 * TICK_HZ && Math.sin(time * 18) > 0);
      if (t instanceof THREE.Sprite)
        (t.material as THREE.SpriteMaterial).opacity = 0.4 + 0.2 * Math.sin(time * 4);
      else {
        t.rotation.z = time * (i % 4 ? -2 : 2);
        t.scale.setScalar(1 + 0.08 * Math.sin(time * 4));
      }
    });
    const me = m.me;
    const fps = this.view === 'fps';
    // bombe
    let nb = 0;
    for (const b of s.bombs) {
      if (nb >= this.bombPool.length) break;
      if (b.held === m.meId && fps) continue;
      let bx: number;
      let by: number;
      let lift: number;
      if (b.held !== null) {
        const h = s.players[b.held]!;
        [bx, by] = m.lerp(`p${h.id}`, h.px, h.py);
        lift = 0.8;
      } else {
        const pos = m.bombPos(b);
        bx = pos.x;
        by = pos.y;
        lift = pos.lift * 2;
      }
      const g = this.bombPool[nb++]!;
      const hot = b.fuse < 16;
      const rate = hot ? 22 : 9;
      const sc = 1 + Math.sin(time * rate) * 0.06;
      g.visible = true;
      g.position.set(bx, lift, by);
      g.scale.set(sc, sc * (1 - 0.04 * Math.sin(time * rate)), sc);
      if (b.fly) g.rotation.x += 0.3;
      else g.rotation.x = 0;
      const owner = s.players[b.owner];
      const body = g.userData.body as THREE.MeshStandardMaterial;
      const stopped = s.timeStop !== null && s.timeStop.owner !== b.owner;
      body.color.set(
        b.kind !== 'normal'
          ? SPECIAL_COLOR[b.kind]
          : stopped
            ? '#8a90a8'
            : m.team && owner
              ? TEAMS[owner.team]!.bomb
              : this.theme.c3.bomb,
      );
      body.emissiveIntensity = hot ? (Math.sin(time * rate) > 0 ? 1.2 : 0.1) : 0;
      for (const o of g.children) {
        if (o.name === 'spark') o.scale.setScalar(0.25 + Math.random() * 0.2);
        if (o.name === 'ant') {
          o.visible = b.remote;
          o.children[1]!.visible = Math.sin(time * 9) > 0;
        }
      }
    }
    for (let i = nb; i < this.bombPool.length; i++) this.bombPool[i]!.visible = false;
    this.renderSpiders(m);
    this.renderClouds(m, dt);
    // steaguri
    if (s.ctf)
      s.ctf.flags.forEach((f, i) => {
        const g = this.flags[i];
        if (!g) return;
        if (f.carrier !== null) {
          const c = s.players[f.carrier]!;
          const [cx, cy] = m.lerp(`p${c.id}`, c.px, c.py);
          g.position.set(cx - 0.15, 0.55, cy);
          g.visible = !(f.carrier === m.meId && fps);
        } else {
          g.position.set(f.x, 0, f.y);
          g.visible = true;
        }
        g.getObjectByName('cloth')!.rotation.y = Math.sin(time * 5) * 0.3;
      });
    // lumini de explozie
    for (const e of this.expLights) {
      e.t += dt;
      e.l.intensity = e.t < 0.45 ? 4 * LEGACY * 6 * (1 - e.t / 0.45) : 0;
    }
    this.renderPlayers(m, dt);
    if (s.mission) this.renderMission(m);
    // mâna cu bomba
    if (this.vm) {
      const show = fps && me.alive && (me.carry !== null || me.active < me.bombs);
      this.vm.visible = fps && me.alive && !m.doom && !m.hero;
      const vb = this.vm.getObjectByName('vb')!;
      vb.visible = show;
      this.vmKick = Math.max(0, this.vmKick - dt * 4);
      const w = this.walk.get(0) ?? 0;
      const bob = me.moving ? Math.sin(w) : 0;
      this.vm.position.set(
        0.4 + bob * 0.012,
        -0.34 + Math.abs(bob) * 0.015 - this.vmKick * 0.18,
        -0.8 + this.vmKick * 0.12,
      );
      this.vm.rotation.x = 0.15 - this.vmKick * 0.6;
      for (const o of vb.children) if (o.name === 'spark') o.scale.setScalar(0.25 + Math.random() * 0.2);
    }
    this.updateCamera(m, dt);
    this.r.render(this.scene, this.cam);
  }

  private addSpider(): void {
    const g = new THREE.Group();
    const bm = std({ color: '#231830', roughness: 0.4, metalness: 0.3 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), bm);
    body.scale.set(1, 0.7, 1.25);
    body.position.y = 0.2;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), bm);
    head.position.set(0, 0.2, 0.2);
    g.add(head);
    for (const sd of [-1, 1]) {
      const e = new THREE.Mesh(
        new THREE.SphereGeometry(0.028, 6, 4),
        new THREE.MeshBasicMaterial({ color: '#ff3b3b' }),
      );
      e.position.set(sd * 0.045, 0.25, 0.29);
      g.add(e);
    }
    for (const sd of [-1, 1])
      for (let i = 0; i < 4; i++) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.36, 5), bm);
        l.position.set(sd * 0.2, 0.14, -0.12 + i * 0.09);
        l.rotation.z = sd * 1.05;
        l.name = `leg${i}${sd > 0 ? 'r' : 'l'}`;
        g.add(l);
      }
    g.visible = false;
    this.root.add(g);
    this.spiders.push(g);
  }

  private renderSpiders(m: Match): void {
    const s = m.s;
    while (this.spiders.length < s.spiders.length) this.addSpider();
    this.spiders.forEach((g, i) => {
      const c = s.spiders[i];
      g.visible = !!c;
      if (!c) return;
      const [x, y] = m.lerp(`s${c.id}`, c.px, c.py);
      g.position.set(x, 0, y);
      g.rotation.y = Math.atan2(DX[c.dir]!, DY[c.dir]!);
      const w = this.time * 18 + c.id;
      for (const o of g.children)
        if (o.name.startsWith('leg')) {
          const li = Number(o.name[3]);
          const sd = o.name[4] === 'r' ? 1 : -1;
          o.rotation.x = Math.sin(w + li * 1.6 + (sd > 0 ? Math.PI : 0)) * 0.5;
        }
    });
  }

  private addCloud(): void {
    const g = new THREE.Group();
    const mat = std({
      color: '#eef2fb',
      roughness: 0.9,
      transparent: true,
      opacity: 0.95,
      emissive: '#fff36b',
      emissiveIntensity: 0,
    });
    for (const [ox, oy, oz, r] of [
      [-0.25, 0, 0, 0.26],
      [0.25, 0, 0, 0.26],
      [0, 0.12, 0, 0.33],
      [0, 0, 0.18, 0.24],
      [0, 0, -0.18, 0.24],
    ] as const) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
      b.position.set(ox, oy, oz);
      b.castShadow = true;
      g.add(b);
    }
    g.userData.mat = mat;
    g.visible = false;
    this.root.add(g);
    this.clouds.push(g);
  }

  private renderClouds(m: Match, dt: number): void {
    const s = m.s;
    const time = this.time;
    const th = this.theme;
    const dark = th.style === 'neon' || th.style === 'cosmos' || th.style === 'halloween';
    this.flash = Math.max(0, this.flash - dt * 3);
    this.hemi.intensity = ((dark ? 0.35 : 0.6) + this.flash * 1.2) * LEGACY;
    this.sun.intensity = ((dark ? 0.55 : 1.25) + this.flash * 0.8) * LEGACY;
    while (this.clouds.length < s.clouds.length) this.addCloud();
    this.clouds.forEach((g, i) => {
      const c = s.clouds[i];
      g.visible = !!c;
      if (!c) return;
      const [x, y] = m.lerp(`c${c.id}`, c.px, c.py);
      const ch = c.charge >= 0;
      const fade = c.life < 12 ? c.life / 12 : 1;
      g.position.set(x, 1.55 + Math.sin(time * 2 + c.id) * 0.06, y);
      g.scale.setScalar(0.9 * fade + 0.1);
      const mat = g.userData.mat as THREE.MeshStandardMaterial;
      mat.color.set(ch ? (Math.sin(time * 25) > 0.3 ? '#9aa3c0' : '#4a5068') : '#eef2fb');
      mat.emissiveIntensity = ch && Math.sin(time * 30) > 0.6 ? 0.8 : 0;
    });
    for (const b of this.strikes) b.t -= dt;
    this.strikes = this.strikes.filter((b) => b.t > 0);
    this.bolts.forEach((mesh, i) => {
      const b = this.strikes[i];
      mesh.visible = !!b;
      if (b) {
        mesh.position.set(b.x + (Math.random() - 0.5) * 0.15, 0.75, b.y);
        mesh.rotation.z = (Math.random() - 0.5) * 0.25;
      }
    });
  }

  private renderPlayers(m: Match, dt: number): void {
    const s = m.s;
    const fps = this.view === 'fps';
    const hero = m.hero;
    if (s.players.length > this.players.length) this.buildPlayers(s);
    s.players.forEach((p, i) => {
      const g = this.players[i];
      if (!g) return;
      const [x, y] = m.lerp(`p${p.id}`, p.px, p.py);
      if (!p.alive) {
        const d = (s.tick - p.deathTick) / TICK_HZ;
        g.visible = d < 1.4;
        g.position.set(x, d * 1.2, y);
        g.rotation.y += 0.3;
        g.scale.setScalar(Math.max(0.05, 1 - d * 0.6));
        return;
      }
      const isHero = hero !== null && hero.player === p.id;
      const viewer = m.me.alive ? m.me : null;
      g.visible = !(p.id === m.meId && fps && !m.doom && !isHero) && canSee(s, viewer, p);
      g.scale.setScalar((g.userData.size as number | undefined) ?? 1);
      let w = this.walk.get(p.id) ?? p.id;
      if (p.moving || (isHero && hero.kind === 'speed'))
        w += dt * ((p.speed * TICK_HZ) / U) * 5 + (isHero && hero.kind === 'speed' ? dt * 30 : 0);
      this.walk.set(p.id, w);
      const walk = p.moving || (isHero && hero.kind === 'speed') ? Math.sin(w) : 0;
      g.position.set(x, p.moving ? Math.abs(walk) * 0.05 : 0, y);
      const jump = isHero && (hero.kind === 'win' || hero.kind === 'team');
      if (isHero) {
        if (jump) {
          g.position.y = Math.abs(Math.sin(hero.t * 7)) * 0.35;
          g.rotation.y += 0.25;
        } else g.position.y = Math.abs(Math.sin(hero.t * 9)) * 0.1;
        g.scale.setScalar(1 + 0.08 * Math.sin(hero.t * 12));
      }
      const ty = Math.atan2(DX[p.face]!, DY[p.face]!);
      let d = ty - g.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (!jump) g.rotation.y += d * 0.3;
      for (const o of g.children) {
        if (o.name === 'shield')
          o.visible = p.shieldT > 0 && !(p.shieldT < 2 * TICK_HZ && Math.sin(this.time * 20) > 0);
        if (o.name === 'foot-1') o.position.z = walk * 0.1;
        if (o.name === 'foot1') o.position.z = -walk * 0.1;
        if (o.name === 'halo') o.scale.setScalar(1 + 0.12 * Math.sin(this.time * 5));
        if (o.name === 'ice') o.visible = p.frozenT > 0;
        if (o.name === 'crown') o.visible = s.crown?.holder === p.id;
        if (o.name === 'potato') {
          o.visible = s.potato?.holder === p.id;
          const left = s.potato?.fuse ?? 99;
          ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity =
            left < 3 * TICK_HZ && Math.sin(this.time * 24) > 0 ? 1.2 : 0;
        }
      }
    });
  }

  private updateCamera(m: Match, dt: number): void {
    const s = m.s;
    const cam = this.cam;
    const me = m.me;
    this.shake = Math.max(0, this.shake - dt * 2.6);
    const motion = settings.motion;
    const sh = motion ? this.shake * this.shake * 0.12 : 0;
    const jx = (Math.random() - 0.5) * sh;
    const jy = (Math.random() - 0.5) * sh;
    const hero = m.hero;
    const heroP = hero ? s.players[hero.player] : undefined;
    const free = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < s.W && y < s.H && s.grid[y * s.W + x] === 0;
    if (heroP && heroP.alive && !m.doom) {
      const [px, py] = m.lerp(`p${heroP.id}`, heroP.px, heroP.py);
      const hx = Math.round(px);
      const hy = Math.round(py);
      if (!this.cineDir)
        this.cineDir = (CROSS.slice(1).find(([dx, dy]) => free(hx + dx, hy + dy)) ?? [0, 1]) as [
          number,
          number,
        ];
      const [ax, az] = this.cineDir;
      const k = Math.min(1, hero!.t / 0.4);
      const jump = hero!.kind === 'win' || hero!.kind === 'team' ? Math.abs(Math.sin(hero!.t * 7)) * 0.35 : 0;
      cam.fov = 55;
      cam.position.set(
        px + ax * 1.3 + jx,
        1.1 + 0.6 * (1 - k) + (free(hx + ax, hy + az) ? 0 : 0.7),
        py + az * 1.3,
      );
      cam.lookAt(px, 0.45 + jump, py);
      this.players[heroP.id]!.visible = true;
    } else if (m.doom && (me.alive || s.tick - me.deathTick < 1.3 * TICK_HZ)) {
      const [px, py] = m.lerp(`p${m.meId}`, me.px, me.py);
      const hx = Math.round(px);
      const hy = Math.round(py);
      if (!this.cineDir) {
        const b = s.bombs.find((o) => o.id === m.doom!.bomb);
        const pref = CROSS.slice(1).sort((d1, d2) =>
          b ? d2[0] * (hx - b.x) + d2[1] * (hy - b.y) - (d1[0] * (hx - b.x) + d1[1] * (hy - b.y)) : 0,
        );
        this.cineDir = (pref.find(([dx, dy]) => free(hx + dx, hy + dy)) ??
          pref.find(([dx, dy]) => s.grid[(hy + dy) * s.W + hx + dx] !== HARD) ?? [0, 1]) as [number, number];
      }
      const [ax, az] = this.cineDir;
      const k = Math.min(1, m.doom.t / 0.5);
      cam.fov = 55;
      cam.position.set(
        px + ax * 1.15 + jx,
        1.05 + 0.6 * (1 - k) + (free(hx + ax, hy + az) ? 0 : 0.7),
        py + az * 1.15,
      );
      cam.lookAt(px, 0.42 + (me.alive ? 0 : ((s.tick - me.deathTick) / TICK_HZ) * 1.2), py);
      this.players[m.meId]!.visible = true;
    } else if (me.alive) {
      this.cineDir = null;
      if (!this.camInit) {
        this.yaw = Math.atan2(DX[me.face]!, DY[me.face]!);
        this.camInit = true;
      }
      const [px, py] = m.lerp(`p${m.meId}`, me.px, me.py);
      const dx = Math.sin(this.yaw);
      const dz = Math.cos(this.yaw);
      if (this.view === 'fps') {
        const w = this.walk.get(0) ?? 0;
        const bob = me.moving ? Math.abs(Math.sin(w)) * 0.04 : 0;
        cam.fov = 78;
        cam.position.set(px - dx * 0.2 + jx, 0.62 + bob + jy, py - dz * 0.2);
        cam.lookAt(px + dx * 3, 0.45, py + dz * 3);
      } else {
        cam.fov = 62;
        cam.position.set(px - dx * 1.7 + jx, 3.7 + jy, py - dz * 1.7);
        cam.lookAt(px + dx * 1.3, 0, py + dz * 1.3);
      }
    } else {
      this.cineDir = null;
      cam.fov = 55;
      if (s.inf) {
        const [px, py] = m.lerp(`p${m.meId}`, me.px, me.py);
        cam.position.set(px + jx, 12, py + 9);
        cam.lookAt(px, 0, py);
      } else {
        cam.position.set(s.W / 2 - 0.5 + jx, Math.max(s.W, s.H) * 0.75, s.H / 2 - 0.5 + s.H * 0.75);
        cam.lookAt(s.W / 2 - 0.5, 0, s.H / 2 - 0.5);
      }
    }
    if (me.alive && me.dizzyT > 0 && motion) {
      const a = Math.min(1, me.dizzyT / 30);
      const t = this.time;
      cam.rotateZ(Math.sin(t * 2.1) * 0.22 * a);
      cam.rotateX(Math.sin(t * 1.3) * 0.06 * a);
      cam.fov += Math.sin(t * 2.7) * 8 * a;
    }
    cam.updateProjectionMatrix();
  }
}
