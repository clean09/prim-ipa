// Sternenleben – WebGL2-Darstellung. Alles Sichtbare kommt aus dem Innenzustand (StarState): Farbe = Schwarzkörper(T),
// Granulation aus M/(T·R) (wie Desktop LifeScene.Apply), Wind aus L und T, Schalen im Schnitt aus st.onion.
import { createGL, Prog } from '../gl/glutil';
import { El, Look, StarState, StellarModel, blackbody, step, TSun } from './model';

const FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform vec2 uRes;
uniform float uTime, uR, uCells, uContrast, uLimb, uSpots, uPulse, uLook, uCut, uWind, uWindCol, uCorona, uSun;
uniform vec3 uCol;
uniform mat3 uRot;
uniform vec4 uNeb;         // x Radius (Bildschirm), y Stärke, z bipolar, w Seed
uniform vec4 uNeb2;        // x Supernova-Blitz, y SNR (Filamente), z Hα/O III Mischung, w Alter des Nebels
uniform vec4 uShellR[8];   // x Radius 0..1, y Element, z brennt, w –
uniform int uShells;
uniform vec3 uElCol[10];
uniform vec4 uComp;        // Begleiter: xy Bildschirm, z Radius, w Temperatur (Farbe in uCompCol)
uniform vec3 uCompCol;

float h31(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
vec3 h33(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 1.7; a *= .5; } return s; }
// Granulation: Zellen (Worley F2-F1) – helle Zellmitten, dunkle Zwischenräume, Mitten wandern langsam
float gran(vec3 p, float t) {
  vec3 i = floor(p), f = fract(p);
  float d1 = 9., d2 = 9.;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(x, y, z), r = h33(i + g);
    r = .5 + .38 * sin(t * (.4 + r * .5) + 6.28 * r);
    float d = length(g + r - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return clamp((d2 - d1) * 1.6, 0., 1.);
}
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }

// Oberfläche am Punkt n (Objektraum, Einheitskugel), mu = cos(Blickwinkel)
vec3 surface(vec3 n, float mu) {
  vec3 c = uCol;
  float t = uTime;
  if (uCells > 0.) {
    vec3 q = n * uCells / 6.283 * 1.6;
    q += .25 * vec3(fbm(n * 3. + t * .02), fbm(n * 3. + 9.), fbm(n * 3. - 4.));     // Verwirbelung (sonst Kristallkanten)
    float g = gran(q, t * .6);
    float big = fbm(n * 2.4 + t * .015);
    c *= 1. + uContrast * ((g - .55) * 1.1 + (big - .5) * .8);
  }
  if (uSpots > 0.) {
    float s = smoothstep(.62, .72, fbm(n * 4. + 11. + t * .004)) * smoothstep(.75, .2, abs(n.y));
    c *= 1. - uSpots * s * .75;
  }
  // Randverdunkelung (heiße Sterne weniger stark)
  c *= 1. - uLimb * (1. - pow(max(mu, 0.), .55));
  return c;
}

vec3 elCol(float e) { int i = int(e + .5); return uElCol[clamp(i, 0, 9)]; }

// Schnittfläche: Schale nach Radius
vec3 interior(float r, vec3 p) {
  int k = 0;
  for (int i = 0; i < 8; i++) { if (i >= uShells) break; if (r > uShellR[i].x) k = i + 1; }
  k = min(k, max(uShells - 1, 0));
  vec4 s = uShellR[k];
  vec3 c = elCol(s.y) * .55;
  float inner = k > 0 ? uShellR[k - 1].x : 0.;
  float edge = smoothstep(.012, 0., abs(r - s.x)) + (k > 0 ? smoothstep(.012, 0., abs(r - inner)) : 0.);
  c += edge * .35;
  if (s.z > .5) {
    float fl = fbm(p * 9. + uTime * .8);
    c += vec3(1., .62, .25) * (.5 + .9 * fl) * 1.2;
  }
  c *= .85 + .3 * fbm(p * 14.);
  return c * (1.15 - .4 * r);
}

void main() {
  vec2 px = (vUv * uRes - .5 * uRes) / (.5 * min(uRes.x, uRes.y));
  float R = uR * (1. + uPulse);
  vec3 col = vec3(0);
  float r2 = dot(px, px);

  // Hintergrund: ein paar ferne Sterne
  vec2 sp = vUv * uRes / 3.;
  float st = h31(vec3(floor(sp), 1.));
  if (st > .997) col += vec3(.6 + .4 * h31(vec3(floor(sp), 2.))) * (st - .997) * 300. * (.6 + .4 * sin(uTime * 2. + st * 90.));
  col *= .55;

  float look = uLook;   // 0 Stern, 1 Wolke, 2 Protostern, 3 WD, 4 NS, 5 BH, 6 Nichts, 7 Supernova
  // ------------------------------------------------ Wolke
  if (look > .5 && look < 1.5) {
    vec3 q = vec3(px * 1.6, uTime * .02);
    float d = fbm(q + fbm(q * 2.) * .8);
    float core = exp(-r2 * 2.5);
    float dens = smoothstep(.35, .8, d) * (.4 + core);
    col = mix(col, vec3(.05, .03, .04), clamp(dens * 1.6, 0., 1.));
    col += vec3(.9, .35, .3) * pow(d, 4.) * .35 * core + vec3(.25, .4, .9) * pow(fbm(q * 1.3 + 5.), 5.) * .25;
    col += uCol * exp(-r2 / (uR * uR + 1e-4) * .5) * .15 * uR;
  }
  // ------------------------------------------------ Nebel (planetarisch / Überrest) hinter und vor dem Stern
  if (uNeb.y > 0.) {
    float a = atan(px.y, px.x);
    float rr = sqrt(r2);
    float bip = uNeb.z;
    // bipolar: Radius hängt vom Winkel zur Achse ab
    float ax = abs(sin(a + .5));
    float Rn = uNeb.x * mix(1., .55 + .9 * pow(ax, 2.), bip);
    float n1 = fbm(vec3(px * 5., uNeb.w));
    float n2 = fbm(vec3(px * 11. + 3., uNeb.w + uTime * .01));
    float shell = exp(-pow((rr - Rn * (.92 + .16 * n1)) / (Rn * .16 + 1e-3), 2.));
    float inside = smoothstep(Rn * 1.05, Rn * .3, rr) * .35;
    vec3 ha = vec3(1., .22, .28), o3 = vec3(.15, .9, .78);
    float mixHO = smoothstep(Rn * .6, Rn * 1.05, rr);
    vec3 nc = mix(o3, ha, clamp(mixHO + uNeb2.z, 0., 1.));
    float em = shell * (.25 + 1.5 * n2 * n2 * (.5 + n1)) + inside * n1 * n1 * 1.4;
    if (uNeb2.y > .5) {
      // Supernova-Überrest: Filamente
      float fil = pow(1. - abs(2. * fbm(vec3(px * 7., uNeb.w * 1.3)) - 1.), 6.);
      em = shell * (.3 + 1.6 * fil) + inside * .25 * fil;
      nc = mix(vec3(.3, .75, 1.), vec3(1., .3, .25), smoothstep(.35, .65, fbm(vec3(px * 3., 7.))));
    }
    col += nc * em * uNeb.y;
  }
  // Supernova-Feuerball/Blitz
  if (uNeb2.x > 0.) {
    col += vec3(1., .9, .8) * uNeb2.x * (exp(-r2 * 6.) * 2. + exp(-r2 * 40.) * 4.);
  }

  // ------------------------------------------------ Kugel
  float hit = 0.;
  if (look < .5 || (look > 1.5 && look < 5.5) || look > 6.5) {
    float Rd = look > 3.5 && look < 4.5 ? max(R, .012) : R;
    // Korona / Glut um den Stern (hell bleibt hell, auch wenn er klein ist)
    float rr = sqrt(r2);
    if (look < 4.5 || look > 6.5) {
      float gl = exp(-max(rr - Rd, 0.) / (Rd * .35 + .02)) * .35 + exp(-max(rr - Rd, 0.) / (Rd * 1.6 + .06)) * .12 * uCorona;
      col += uCol * gl * (rr > Rd ? 1. : 0.);
    }
    // Wind (kühle Riesen: rötlicher Staubschleier; heiße: bläulicher Hauch)
    if (uWind > 0. && rr > Rd) {
      float wv = fbm(vec3(px / Rd * 1.5 - normalize(px) * uTime * .05, 3.));
      float w = uWind * Rd * Rd / (r2 + 1e-4) * (.4 + .9 * wv) * smoothstep(Rd * 6., Rd, rr);
      col += mix(vec3(.9, .35, .15), vec3(.35, .55, 1.), uWindCol) * w * .25;
    }
    if (r2 < Rd * Rd) {
      hit = 1.;
      // Blickraum (Einheitskugel), Strahl entlang −z; Oberflächenmuster im mitdrehenden Objektraum
      vec3 o2 = vec3(px / Rd, 3.), d2 = vec3(0, 0, -1);
      float zf = sqrt(max(1. - r2 / (Rd * Rd), 0.));
      float t0 = 3. - zf, t1 = 3. + zf;
      vec3 P = o2 + d2 * t0;
      // Schnitt: Viertel oben rechts herausgeschnitten, Kante zeigt schräg zur Kamera (zwei sichtbare Schnittflächen)
      vec3 na = normalize(vec3(1., 0., .75)), nb = normalize(vec3(0., 1., .75));
      bool cut = uCut > .5 && dot(P, na) > 0. && dot(P, nb) > 0. && P.z > 0.;
      if (cut) {
        // Austritt aus dem Keil: an der ersten Ebene, deren Bedingung entlang des Strahls falsch wird
        float ta = dot(d2, na) < 0. ? -dot(o2, na) / dot(d2, na) : 1e9;
        float tb = dot(d2, nb) < 0. ? -dot(o2, nb) / dot(d2, nb) : 1e9;
        // dritte Ebene z = 0: der Keil reicht nur bis zur Mitte (Würfelecke statt durchgehendem Spalt)
        float tc = o2.z;
        float te = min(min(ta, tb), tc);
        if (te < t1) {
          vec3 Q = o2 + d2 * te;
          col = interior(length(Q), uRot * Q) * (te == ta ? 1. : te == tb ? .82 : .66);
          if (look > 2.5 && look < 3.5) col = mix(col, vec3(.8, .85, 1.), .2);
        } else hit = 0.;
      } else {
        vec3 n = uRot * P;
        float mu = zf;
        vec3 s = surface(n, mu) * 1.35;
        if (look > 3.5 && look < 4.5) {
          // Neutronenstern: grell, mit Hotspots an den Magnetpolen
          s = uCol * (1.6 + 2. * pow(max(abs(n.y), 0.), 30.));
        }
        if (look > 4.5 && look < 6.5) s = vec3(0);
        col = s;
      }
      if (look > 4.5 && look < 5.5) col = vec3(0);
    }
    // Schwarzes Loch: Photonenring + verzerrtes Licht
    if (look > 4.5 && look < 5.5) {
      float Rs = max(R, .03);
      float ring = exp(-pow((rr - Rs * 1.5) / (Rs * .08), 2.));
      col = rr < Rs * 1.5 ? col * smoothstep(Rs * 1.4, Rs * 1.5, rr) : col;
      col += vec3(1., .75, .45) * ring * 1.4;
      // flache Scheibe (von schräg oben)
      vec2 dp = vec2(px.x, px.y * 3.2);
      float dr = length(dp);
      float disk = smoothstep(Rs * 2.2, Rs * 2.6, dr) * smoothstep(Rs * 7., Rs * 3., dr) * (.5 + .5 * fbm(vec3(atan(dp.y, dp.x) * 3., dr * 20., uTime * .3)));
      if (!(px.y > 0. && rr < Rs * 1.5)) col += vec3(1., .55, .25) * disk * (1.2 + .8 * px.x / (dr + 1e-3));
    }
    // Pulsar-Strahlkegel
    if (look > 3.5 && look < 4.5) {
      float ang = uTime * 3.;
      vec2 ax = vec2(sin(ang) * .45, cos(ang * .5) * .3 + .9);
      ax = normalize(ax);
      float along = dot(px, ax), perp = length(px - ax * along);
      float beam = exp(-perp / (abs(along) * .12 + .004)) * exp(-abs(along) * 2.2) * smoothstep(0., .02, abs(along));
      col += vec3(.55, .7, 1.) * beam * .9;
    }
    // Protostern: Scheibe + Jets
    if (look > 1.5 && look < 2.5) {
      vec2 dp = vec2(px.x, px.y * 4.);
      float dr = length(dp);
      float disk = smoothstep(Rd * 1.3, Rd * 1.8, dr) * smoothstep(Rd * 9., Rd * 3., dr) * (.4 + .6 * fbm(vec3(dp * 6., uTime * .05)));
      bool front = px.y < 0.;
      vec3 dc = vec3(.55, .32, .2) * disk;
      if (front || hit < .5) col = mix(col, dc + col * .3, clamp(disk * 1.3, 0., 1.));
      float jet = exp(-abs(px.x) / (.01 + abs(px.y) * .05)) * smoothstep(Rd, Rd * 3., abs(px.y)) * exp(-abs(px.y) * 2.5);
      col += vec3(.5, .7, 1.) * jet * .8 * (.6 + .4 * fbm(vec3(px * 8. - vec2(0, uTime * .3 * sign(px.y)), 2.)));
    }
  }
  // Begleiter
  if (uComp.z > 0.) {
    vec2 d = px - uComp.xy;
    float cr = length(d);
    if (cr < uComp.z) { float mu = sqrt(1. - cr * cr / (uComp.z * uComp.z)); col = uCompCol * (.55 + .45 * mu); }
    else col += uCompCol * exp(-(cr - uComp.z) / (uComp.z * .5 + .01)) * .3;
  }
  // Größenvergleich: gestrichelter Kreis = Sonne
  if (uSun > 0.) {
    float rr = sqrt(r2);
    float dash = step(.5, fract(atan(px.y, px.x) * 12.));
    col += vec3(.6) * smoothstep(.004, 0., abs(rr - uSun)) * dash * .5;
  }

  // Tonemapping auf den hellsten Kanal (farbtonerhaltend) – ACES je Kanal bleicht rote Riesen zu Beige aus
  float mx = max(max(col.r, col.g), col.b);
  vec3 tm = mx > 1e-5 ? col * (aces(vec3(mx * 1.05)).r / mx) : col;
  col = mix(tm, aces(col * 1.05), .25);
  col = pow(col, vec3(1. / 1.12));
  col += (h31(vec3(gl_FragCoord.xy, uTime)) - .5) / 255.;
  o = vec4(col, 1);
}`;

const LOOK_ID: Record<Look, number> = {
  Star: 0, Flash: 0, Nebula: 0, Collapse: 0, BrownDwarf: 0,
  Cloud: 1, Proto: 2, WhiteDwarf: 3, NeutronStar: 4, Magnetar: 4, BlackHole: 5, Nothing: 6, Supernova: 7,
};

const EL_RGB: [number, number, number][] = [
  [1.0, .42, .35], [1.0, .79, .29], [.49, .49, .53], [.35, .66, 1.0], [.29, .82, 1.0],
  [.75, .49, 1.0], [.6, .89, .42], [.88, .63, .38], [.95, .89, .29], [.78, .35, .23],
];

/** Sichtbarer Radius (Anteil der halben Bildbreite) aus dem echten Radius – logarithmisch, damit Zwerg und Überriese passen. */
export const dispRadius = (R: number) => Math.min(0.78, Math.max(0.012, 0.3 + 0.13 * Math.log10(Math.max(R, 1e-9))));

export class StarView {
  readonly gl: WebGL2RenderingContext;
  private p: Prog;
  yaw = 0.6; pitch = 0.22; cut = false; scale = 0.6; sunRing = true;
  constructor(readonly canvas: HTMLCanvasElement) {
    this.gl = createGL(canvas);
    this.p = new Prog(this.gl, FS);
  }

  render(model: StellarModel, st: StarState, time: number) {
    const gl = this.gl, c = this.canvas;
    const dpr = Math.min(devicePixelRatio || 1, 2) * this.scale;
    const w = Math.max(1, Math.round(c.clientWidth * dpr)), hh = Math.max(1, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== hh) { c.width = w; c.height = hh; }
    gl.viewport(0, 0, w, hh);
    const seg = model.segs[st.seg];
    const p = this.p.use();
    const look = LOOK_ID[seg.look];
    const pr = st.pulse * 0.8 * Math.sin(1.3 * time);
    const T = st.T * (1 - 0.6 * pr * 0.3);
    let R = look === 7 ? 0 : dispRadius(st.R);
    let [r, g, b] = blackbody(T);
    // Sättigung kühler Sterne anheben (sonst bleicht alles zu Orange-Beige aus)
    const sat = 1 + 0.6 * (1 - step(3000, 6000, T));
    const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    [r, g, b] = [r, g, b].map(x => Math.max(0, lum + (x - lum) * sat)) as [number, number, number];
    // kühle Sterne strahlen je Fläche viel weniger (∝ T⁴) – sonst bleicht der Tonemapper rote Riesen zu Beige aus
    let bright = 1.9 * Math.min(1.25, Math.max(0.42, Math.pow(T / 5772, 0.9)));
    if (look === 1) bright = 0.6;
    if (seg.look === 'BrownDwarf') bright = 0.55 + 0.4 * Math.min(1, st.T / 2500);
    if (seg.look === 'Flash') bright *= 1 + 0.4 * Math.sin(st.prog * Math.PI);
    p.f('uCol', r * bright, g * bright, b * bright);
    p.f('uRes', w, hh).f('uTime', time).f('uR', R).f('uPulse', pr * 0.5);
    // Granulation: Zellen am Umfang = 4000·(M/(T·R))^1.15, mind. 6 px je Zelle
    const pxCirc = 2 * Math.PI * R * 0.5 * Math.min(w, hh);
    let cells = 4000 * Math.pow(Math.max(st.M, 0.05) / ((st.T / TSun) * Math.max(st.R, 1e-3)), 1.15);
    cells = Math.min(cells, pxCirc / 6, 220);
    const hot = step(7000, 11000, st.T);
    const isStar = look === 0 || look === 2;
    p.f('uCells', isStar && seg.look !== 'BrownDwarf' ? Math.max(cells, 6) : 0);
    p.f('uContrast', isStar ? 0.38 * (1 - hot * 0.85) * (cells > 60 ? 0.7 : 1) : 0);
    p.f('uLimb', look === 0 ? 0.55 - 0.3 * hot : look === 3 ? 0.2 : 0.4);
    // Flecken: sonnenartige Sterne mit Konvektionshülle
    p.f('uSpots', look === 0 ? step(3500, 4500, st.T) * (1 - step(6200, 7200, st.T)) * (st.R < 3 ? 0.6 : 0.2) : 0);
    p.f('uCorona', look === 0 ? 1 - 0.6 * step(4500, 3200, st.T) : 0.4);
    // Wind: kühle Riesen (Reimers) und heiße Massereiche/WR
    const coolWind = step(4500, 3200, st.T) * step(30, 300, st.R);
    const hotWind = step(15000, 40000, st.T) * step(1e4, 1e5, st.L);
    p.f('uWind', isStar ? Math.min(1, coolWind * 0.8 + hotWind * 0.7 + (seg.look === 'Nebula' ? 0 : 0)) : 0);
    p.f('uWindCol', hotWind > coolWind ? 1 : 0);
    p.f('uLook', look).f('uCut', this.cut && (look === 0 || look === 2 || look === 3) ? 1 : 0);
    p.f('uSun', this.sunRing && look !== 1 && look !== 7 ? dispRadius(1) : 0);
    // Drehung
    const cy = Math.cos(this.yaw + time * 0.03), sy = Math.sin(this.yaw + time * 0.03), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    // R = Ry * Rx
    const m = [cy, 0, -sy, sy * sp, cp, cy * sp, sy * cp, -sp, cy * cp];
    gl.uniformMatrix3fv(p.u('uRot'), false, new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]));
    // Schalen: Massenanteil → Radiusanteil (Kern ist dicht: r ≈ q^0.6 sichtbar machen)
    const on = st.onion.slice(0, 8);
    const sh = new Float32Array(32);
    on.forEach((s, i) => { sh[i * 4] = Math.pow(Math.min(1, s.massFrac), 0.6); sh[i * 4 + 1] = s.main; sh[i * 4 + 2] = s.burning ? 1 : 0; });
    if (!on.length) { sh[0] = 1; sh[1] = look === 4 ? El.Fe : El.C; }
    gl.uniform4fv(p.u('uShellR'), sh);
    gl.uniform1i(p.u('uShells'), Math.max(1, on.length));
    gl.uniform3fv(p.u('uElCol'), new Float32Array(EL_RGB.flat()));
    // Nebel: planetarischer Nebel wächst über die Phase und bleibt beim weißen Zwerg noch eine Weile sichtbar
    let nebR = 0, nebA = 0, snr = 0, flash = 0, hamix = 0;
    const kNeb = model.segs.findIndex(s => s.look === 'Nebula');
    const kSn = model.segs.findIndex(s => s.look === 'Supernova');
    if (kNeb >= 0 && st.seg >= kNeb) {
      const age = st.seg === kNeb ? st.prog : 1 + (st.seg - kNeb) * 0.5 + st.prog * 0.5;
      nebR = 0.3 + 0.5 * Math.min(age, 1.6) / 1.6;
      nebA = st.seg === kNeb ? step(0, 0.25, st.prog) : Math.max(0, 1 - (age - 1) * 1.1);
      hamix = st.seg === kNeb ? 0.4 * (1 - st.prog) : 0;
    }
    if (kSn >= 0 && st.seg >= kSn) {
      const age = st.seg === kSn ? st.prog : 1 + st.prog;
      flash = st.seg === kSn ? Math.pow(Math.max(0, 1 - st.prog), 2) * 2 : 0;
      nebR = 0.15 + 0.65 * Math.min(age, 2) / 2;
      nebA = st.seg === kSn ? step(0.05, 0.5, st.prog) : Math.max(0.25, 1 - st.prog * 0.5);
      snr = 1;
    }
    p.f('uNeb', nebR, nebA * 0.9, model.bipolar && snr === 0 ? 1 : 0, (model.M0 * 7.31) % 50);
    p.f('uNeb2', flash, snr, hamix, 0);
    // Begleiter
    if (model.CompM > 0 && look !== 1) {
      const cr = dispRadius(Math.pow(model.CompM, 0.8)) * 0.8;
      const ang = time * 0.15 + 1;
      const dist = Math.min(0.85, Math.max(dispRadius(st.R) + cr + 0.08, 0.25 + 0.12 * Math.log10(model.Sep * 215)));
      const [cr2, cg, cb] = blackbody(5772 * Math.pow(model.CompM, 0.5));
      p.f('uComp', Math.cos(ang) * dist * 1.2, Math.sin(ang) * dist * 0.25, cr, 0);
      p.f('uCompCol', cr2, cg, cb);
    } else p.f('uComp', 0, 0, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() { this.p.dispose(); this.gl.getExtension('WEBGL_lose_context')?.loseContext(); }
}
