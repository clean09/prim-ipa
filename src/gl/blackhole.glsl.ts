// Singularität – Raytracer für ein Schwarzes Loch (WebGL2-Fragment-Shader, Port von Singularity.hlsl).
//  • Jeder Lichtstrahl folgt einer Null-Geodäte: Schwarzschild (x'' = −3/2·h²·x/r⁵, RK4) oder Kerr
//    (Hamilton-Gleichungen in Kerr-Schild-Koordinaten, RK4). Einheiten: r_s = 1, M = 0,5.
//  • Akkretionsscheibe als Volumen: Gauß-Profil in der Höhe × Turbulenz (3D-Rauschen), Novikov-Thorne-Temperatur,
//    Doppler + gravitative Rotverschiebung (I ∝ g⁴), Emission/Absorption entlang des Strahls.
//  • Relativistische Jets, tiefschwarzer Himmel mit Milchstraße, Staubwolken, Sternen und ferner Spiralgalaxie.

export const TRACE_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;

in vec2 vUv;
out vec4 outColor;

uniform vec3 uCamPos, uCamF, uCamR, uCamU;
uniform float uTanHalf, uAspect, uTime, uTemp;
uniform vec2 uRes;
uniform int uMaxSteps, uFlags, uQuality;
uniform float uSpin, uRin, uRplus, uEscape, uJet, uDensity, uGlow;
uniform sampler3D uNoise;

#define PI 3.14159265
#define DISK_OUT 18.0
#define F_DOPPLER 1
#define F_DISK 2
#define F_STARS 4
#define F_KERR 16
#define MM 0.5
#define NOISE_N 64.0

uint hash(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
float rnd(uint x) { return float(hash(x) & 0xFFFFFFu) / 16777216.0; }

float vnoise3(vec3 p) {
  vec3 i = floor(p), f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  return texture(uNoise, (i + f + 0.5) / NOISE_N).r;
}
float fbm3(vec3 p, int oct) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 6; ++i) {
    if (i >= oct) break;
    s += a * vnoise3(p); n += a; p = p * 2.03 + vec3(17.1, 9.2, 4.7); a *= 0.5;
  }
  return s / n;
}

vec3 blackbody(float T) {
  float t = clamp(T, 1000.0, 40000.0) / 100.0;
  float r = t <= 66.0 ? 1.0 : 1.2929362 * pow(t - 60.0, -0.1332048);
  float g = t <= 66.0 ? 0.3900816 * log(t) - 0.6318414 : 1.1298909 * pow(t - 60.0, -0.0755148);
  float b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : 0.5432068 * log(t - 10.0) - 1.1962541);
  vec3 c = clamp(vec3(r, g, b), 0.0, 1.0);
  return c * c;
}

// ------------------------------------------------------------------------------------------- Himmel
const vec3 BAND_N = vec3(-0.01381, -0.77434, -0.63261);
const vec3 CORE_D = vec3(-0.97392, -0.13287, 0.18390);
const vec3 GAL_D  = vec3(-0.42071, -0.33650, 0.84248);

vec3 galaxy(vec3 d) {
  float cz = dot(d, GAL_D);
  if (cz < 0.97) return vec3(0.0);
  vec3 t1 = normalize(cross(GAL_D, vec3(0.0, 1.0, 0.0))), t2 = cross(GAL_D, t1);
  vec2 p = vec2(dot(d, t1), dot(d, t2)) / cz;
  float s = 0.47, c = 0.88;
  vec2 q = vec2(p.x * c - p.y * s, (p.x * s + p.y * c) / 0.38) / 0.1;
  float r = length(q), th = atan(q.y, q.x);
  float arm = pow(0.5 + 0.5 * cos(2.0 * th - 5.0 * log(r + 0.02)), 4.0);
  float mott = 0.55 + 0.9 * vnoise3(d * 420.0);
  float disk = exp(-r * 2.6) * (0.08 + 0.9 * arm * mott) * smoothstep(1.6, 0.9, r);
  float bulge = exp(-r * r * 60.0);
  return disk * vec3(0.55, 0.68, 1.0) * 0.11 + bulge * vec3(1.0, 0.78, 0.52) * 0.9;
}

// Sterne: zufällige Punkte in einem 3D-Gitter auf der Himmelskugel (zwei Ebenen: wenige helle, viele schwache)
vec3 starLayer(vec3 d, float K, float prob, float bright, float pix) {
  vec3 p = d * K;
  vec3 cell = floor(p);
  uvec3 ci = uvec3(ivec3(cell) + 4096);
  uint h = hash(ci.x * 73856093u ^ ci.y * 19349663u ^ ci.z * 83492791u);
  if (rnd(h) > prob) return vec3(0.0);
  vec3 sp = cell + vec3(rnd(h ^ 0x68bc21ebu), rnd(h ^ 0x02e5be93u), rnd(h ^ 0x967a889bu));
  vec3 dd = p - sp;
  dd -= dot(dd, d) * d;                                  // Abstand quer zur Blickrichtung
  float w = max(pix * K, 0.02);
  float I = exp(-dot(dd, dd) / (w * w)) * bright * pow(rnd(h ^ 0x9e3779b9u), 3.0);
  float T = 3000.0 + 9000.0 * rnd(h ^ 0x5bd1e995u);
  return I * normalize(blackbody(T) + 0.05);
}

vec3 sky(vec3 d, float pix) {
  float b = dot(d, BAND_N);
  float band = exp(-b * b * 26.0), wide = exp(-b * b * 6.0);
  float cd = dot(d, CORE_D);
  float bulge = pow(clamp(cd, 0.0, 1.0), 24.0) * exp(-b * b * 14.0);
  int oct = uQuality >= 2 ? 5 : 4;
  float n = fbm3(d * 5.0, oct);
  float fine = fbm3(d * 23.0 + 5.3, 3);
  float lane = smoothstep(0.44, 0.60, fbm3(d * 8.0 + 3.1, oct)) * clamp(band * 1.6, 0.0, 1.0);
  float cloud = smoothstep(0.50, 0.66, fbm3(d * 2.6 + 11.0, 4)) * (0.35 + 0.65 * wide);
  float dark = max(lane, cloud * 0.9);
  float ext = max(1.0 - 0.97 * dark, 0.02);
  vec3 mwCol = mix(vec3(0.50, 0.60, 1.0), vec3(1.0, 0.86, 0.66), clamp(bulge * 2.0 + pow(clamp(cd, 0.0, 1.0), 4.0) * 0.3, 0.0, 1.0));
  float glow = band * (0.004 + 0.22 * n * n * n * (0.4 + 1.2 * fine)) + bulge * (0.015 + 0.30 * n * n * fine);
  vec3 col = glow * mwCol * (1.0 - 0.985 * dark);
  float neb = pow(clamp(fbm3(d * 2.2 + 7.3, 4) - 0.56, 0.0, 1.0) * 3.2, 3.0);
  col += neb * mix(vec3(0.34, 0.03, 0.07), vec3(0.03, 0.16, 0.22), fbm3(d * 1.3, 2)) * 0.07 * (1.0 - 0.8 * dark);
  col += galaxy(d) * (1.0 - 0.9 * cloud);
  if ((uFlags & F_STARS) != 0) {
    vec3 st = starLayer(d, 70.0, 0.05, 5.0, pix) + starLayer(d, 220.0, 0.06, 1.2, pix) * (0.25 + band * 2.5);
    col += st * sqrt(ext);
  }
  return col;
}

// ------------------------------------------------------------------------------------------- Scheibe
float diskT(float r) { float x = uRin / r; return pow(x, 0.75) * pow(max(1.0 - sqrt(x), 0.0), 0.25) / 0.4880; }

float gSchwarzschild(vec3 p, vec3 photonDir) {
  if ((uFlags & F_DOPPLER) == 0) return 1.0;
  float r = max(length(p.xz), 1.05);
  float beta = sqrt(0.5 / (r - 1.0));
  float gam = inversesqrt(max(1.0 - beta * beta, 1e-4));
  vec3 vhat = normalize(vec3(-p.z, 0.0, p.x));
  return sqrt(1.0 - 1.0 / r) / (gam * (1.0 - beta * dot(vhat, photonDir)));
}

float gKerr(vec3 xw, vec3 pw, float r) {
  if ((uFlags & F_DOPPLER) == 0) return 1.0;
  float lam = -(xw.x * pw.z - xw.z * pw.x);
  float a = uSpin, sM = sqrt(MM);
  float Om = sM / (pow(r, 1.5) + a * sM);
  float gtt = -(1.0 - 2.0 * MM / r), gtp = -2.0 * MM * a / r, gpp = r * r + a * a + 2.0 * MM * a * a / r;
  float nrm = -(gtt + 2.0 * Om * gtp + Om * Om * gpp);
  if (nrm <= 0.0) return 1.0;
  return sqrt(nrm) / (1.0 - Om * lam);
}

void diskPoint(vec3 p, float g, out float rho, out vec3 S) {
  rho = 0.0; S = vec3(0.0);
  float r = sqrt(max(p.x * p.x + p.z * p.z - uSpin * uSpin, 0.0));
  if (r < uRin * 0.9 || r > DISK_OUT + 2.0) return;
  float Hh = 0.018 * r + 0.04;
  float yh = p.y / Hh;
  if (abs(yh) > 3.5) return;
  float radial = smoothstep(uRin * 0.92, uRin + 0.35, r) * (1.0 - smoothstep(DISK_OUT - 5.0, DISK_OUT + 2.0, r));
  float phi = atan(p.z, p.x);
  float omega = sqrt(MM) / (pow(r, 1.5) + uSpin * sqrt(MM));
  float th = phi - omega * uTime * 2.0;
  float thl = th + r * 0.39;
  vec3 q = vec3(r * 2.2 + yh * 0.45, cos(th) * 5.0, sin(th) * 5.0);
  int oct = uQuality >= 2 ? 5 : 4;
  float n = fbm3(q, oct) * 0.75 + 0.35 * fbm3(q * 3.1 + 11.0, uQuality >= 2 ? 3 : 2);
  float lanes = smoothstep(0.25, 0.8, fbm3(vec3(r * 7.5 + yh * 0.3, cos(thl) * 0.9, sin(thl) * 0.9), uQuality >= 1 ? 4 : 3));
  float prof = exp(-0.5 * yh * yh) / (Hh * 2.5066283);
  rho = prof * radial * (0.25 + 1.5 * n * n) * (0.45 + 0.9 * lanes) * uDensity;
  float T = diskT(max(r, uRin));
  float Tloc = uTemp * T * (1.0 - 0.12 * min(yh * yh, 4.0));
  float I = T * T * T * 1.3 * (0.45 + 1.2 * n) * (0.35 + 1.4 * lanes * lanes);
  float g4 = g * g * g * g;
  S = blackbody(Tloc * g) * I * g4 * 2.4 * uGlow;
}

void diskSegment(vec3 x0, vec3 x1, vec3 m, bool kerr, uint seed, inout vec3 col, inout float trans) {
  float HM = 3.5 * (0.018 * (DISK_OUT + 2.0) + 0.04);
  if (min(x0.y, x1.y) > HM || max(x0.y, x1.y) < -HM) return;
  float ra = length(x0.xz), rb = length(x1.xz);
  if (max(ra, rb) < uRin * 0.85 || min(ra, rb) > DISK_OUT + 3.0) return;
  int nS = uQuality >= 2 ? 6 : uQuality == 1 ? 4 : 3;
  float L = length(x1 - x0), ds = L / float(nS);
  float j = rnd(seed);
  vec3 dir = (x1 - x0) / max(L, 1e-6);
  for (int k = 0; k < 6; ++k) {
    if (k >= nS) break;
    vec3 p = mix(x0, x1, (float(k) + j) / float(nS));
    float r = kerr ? sqrt(max(p.x * p.x + p.z * p.z - uSpin * uSpin, 0.0)) : length(p.xz);
    float g = kerr ? gKerr(p, m, max(r, uRin)) : gSchwarzschild(p, -dir);
    float rho; vec3 S;
    diskPoint(p, g, rho, S);
    if (rho <= 1e-5) continue;
    float dtau = 1.6 * rho * ds * sqrt(2.0 * uRin / max(r, uRin));
    float e = 1.0 - exp(-dtau);
    col += trans * S * e;
    trans *= 1.0 - e;
    if (trans < 0.01) return;
  }
}

// ------------------------------------------------------------------------------------------- Jets
vec3 jetGlow(vec3 a, vec3 b) {
  vec3 d = b - a;
  float dd = dot(d.xz, d.xz);
  float t = dd > 1e-12 ? clamp(-dot(a.xz, d.xz) / dd, 0.0, 1.0) : 0.0;
  vec3 p = a + t * d;
  float ay = abs(p.y);
  if (ay < 1.0 || ay > 60.0) return vec3(0.0);
  float w = 0.2 + 0.075 * ay;
  float rho2 = dot(p.xz, p.xz);
  if (rho2 > 9.0 * w * w) return vec3(0.0);
  float L = length(d);
  vec3 dir = d / max(L, 1e-6);
  float hf = max(sqrt(dd) / max(L, 1e-6), 0.02);
  float path = min(L, 1.772 * w / hf);
  float on = smoothstep(1.0, 2.8, ay) * (1.0 - smoothstep(30.0, 60.0, ay));
  float ang = atan(p.z, p.x);
  float knots = 0.35 + 1.3 * fbm3(vec3(ay * 0.7 - uTime * 1.5, cos(ang) * 1.5, sin(ang) * 1.5 + (p.y > 0.0 ? 0.0 : 13.0)), 3);
  float cosT = -dir.y * (p.y > 0.0 ? 1.0 : -1.0);
  float D = 1.0 / (1.25 * (1.0 - 0.6 * cosT));
  float I = uJet * exp(-rho2 / (w * w)) * path / w * on * knots * D * D * D * 0.9 / (1.0 + 0.1 * ay);
  float core = exp(-2.0 * rho2 / (w * w));
  return I * mix(vec3(0.30, 0.45, 1.0), vec3(0.85, 0.9, 1.0), core);
}

// ------------------------------------------------------------------------------------------- Geodäten
vec3 accelg(vec3 x, float h2) { float r2 = dot(x, x); float r = sqrt(r2); return -1.5 * h2 * x / (r2 * r2 * r); }

void kerrDeriv(vec3 xw, vec3 pw, float a, float pt, out vec3 dxw, out vec3 dpw, out float rout) {
  float X = xw.x, Y = xw.z, Z = -xw.y;
  float pX = pw.x, pY = pw.z, pZ = -pw.y;
  float a2 = a * a;
  float R2 = X * X + Y * Y + Z * Z;
  float w = R2 - a2;
  float D = sqrt(w * w + 4.0 * a2 * Z * Z);
  float r2 = max(0.5 * (w + D), 1e-8);
  float r = sqrt(r2);
  D = max(D, 1e-6);
  float den = r2 + a2;
  float Q = r2 * r2 + a2 * Z * Z;
  float r3 = r2 * r;
  float f = 2.0 * MM * r3 / Q;
  float lX = (r * X + a * Y) / den, lY = (r * Y - a * X) / den, lZ = Z / r;
  float A = -pt + lX * pX + lY * pY + lZ * pZ;
  vec3 dx = vec3(pX - f * A * lX, pY - f * A * lY, pZ - f * A * lZ);
  vec3 gr = vec3(X * r / D, Y * r / D, Z * den / (r * D));
  vec3 dQ = 4.0 * r3 * gr + vec3(0.0, 0.0, 2.0 * a2 * Z);
  vec3 gf = 2.0 * MM * (3.0 * r2 * gr * Q - r3 * dQ) / (Q * Q);
  float S = X * pX + Y * pY;
  float N = (r * X + a * Y) * pX + (r * Y - a * X) * pY;
  vec3 dN = gr * S + vec3(r * pX - a * pY, a * pX + r * pY, 0.0);
  vec3 dNd = (dN * den - N * 2.0 * r * gr) / (den * den);
  vec3 dZr = pZ * (vec3(0.0, 0.0, r) - Z * gr) / r2;
  vec3 dp = 0.5 * A * A * gf + f * A * (dNd + dZr);
  dxw = vec3(dx.x, -dx.z, dx.y);
  dpw = vec3(dp.x, -dp.z, dp.y);
  rout = r;
}

float kerrR(vec3 xw, float a) {
  float Z = -xw.y;
  float w = dot(xw, xw) - a * a;
  return sqrt(max(0.5 * (w + sqrt(w * w + 4.0 * a * a * Z * Z)), 1e-8));
}

vec3 kerrInitP(vec3 xw, vec3 d, float a, float pt) {
  float X = xw.x, Y = xw.z, Z = -xw.y;
  vec3 dl = vec3(d.x, d.z, -d.y);
  float r = kerrR(xw, a);
  float a2 = a * a, den = r * r + a2;
  float f = 2.0 * MM * r * r * r / (r * r * r * r + a2 * Z * Z);
  float c = ((r * X + a * Y) * dl.x + (r * Y - a * X) * dl.y) / den + Z / r * dl.z;
  float q = 1.0 - f * c * c;
  float k = (-f * c * pt + sqrt(f * f * c * c + q * (1.0 + f))) / q;
  return k * d;
}

bool shadeSegment(vec3 x, vec3 xn, vec3 m, bool kerr, uint seed, int i, inout vec3 col, inout float trans) {
  if (uJet > 0.0) col += trans * jetGlow(x, xn);
  if ((uFlags & F_DISK) != 0) diskSegment(x, xn, m, kerr, seed ^ (uint(i) * 0x27d4eb2du), col, trans);
  return trans < 0.01;
}

vec3 traceSchwarzschild(vec3 x, vec3 v, uint seed, float pix) {
  v = normalize(v);
  vec3 Lv = cross(x, v);
  float h2 = dot(Lv, Lv);
  vec3 col = vec3(0.0); float trans = 1.0;
  for (int i = 0; i < 400; ++i) {
    if (i >= uMaxSteps) break;
    float r = length(x);
    if (r < 1.0) return col;
    if (r > uEscape && dot(x, v) > 0.0) return col + trans * sky(normalize(v), pix);
    float dt = 0.07 * r * clamp((r - 1.0) * 1.5, 0.15, 1.0);
    vec3 k1x = v,                  k1v = accelg(x, h2);
    vec3 k2x = v + 0.5 * dt * k1v, k2v = accelg(x + 0.5 * dt * k1x, h2);
    vec3 k3x = v + 0.5 * dt * k2v, k3v = accelg(x + 0.5 * dt * k2x, h2);
    vec3 k4x = v + dt * k3v,       k4v = accelg(x + dt * k3x, h2);
    vec3 xn = x + dt / 6.0 * (k1x + 2.0 * k2x + 2.0 * k3x + k4x);
    vec3 vn = v + dt / 6.0 * (k1v + 2.0 * k2v + 2.0 * k3v + k4v);
    if (shadeSegment(x, xn, 0.5 * (v + vn), false, seed, i, col, trans)) return col;
    x = xn; v = vn;
  }
  if (length(x) < 6.0) return col;
  return col + trans * sky(normalize(v), pix);
}

vec3 traceKerr(vec3 x, vec3 d, uint seed, float pix) {
  float a = uSpin;
  vec3 p = kerrInitP(x, normalize(d), a, 1.0);
  vec3 col = vec3(0.0); float trans = 1.0;
  vec3 k1x, k1p, k2x, k2p, k3x, k3p, k4x, k4p; float r, rr;
  for (int i = 0; i < 400; ++i) {
    if (i >= uMaxSteps) break;
    kerrDeriv(x, p, a, 1.0, k1x, k1p, r);
    if (r < uRplus * 1.02) return col;
    float Rl = length(x);
    if (Rl > uEscape && dot(x, k1x) > 0.0) return col + trans * sky(normalize(k1x), pix);
    float h = 0.06 * Rl * clamp((r - uRplus) * 1.5, 0.08, 1.0) / max(length(k1x), 0.2);
    kerrDeriv(x + 0.5 * h * k1x, p + 0.5 * h * k1p, a, 1.0, k2x, k2p, rr);
    kerrDeriv(x + 0.5 * h * k2x, p + 0.5 * h * k2p, a, 1.0, k3x, k3p, rr);
    kerrDeriv(x + h * k3x, p + h * k3p, a, 1.0, k4x, k4p, rr);
    vec3 xn = x + h / 6.0 * (k1x + 2.0 * k2x + 2.0 * k3x + k4x);
    vec3 pn = p + h / 6.0 * (k1p + 2.0 * k2p + 2.0 * k3p + k4p);
    if (shadeSegment(x, xn, 0.5 * (p + pn), true, seed, i, col, trans)) return col;
    x = xn; p = pn;
  }
  if (length(x) < 6.0) return col;
  return col + trans * sky(normalize(p), pix);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  uint seed = hash(uint(px.x) * 1973u + uint(px.y) * 9277u);
  float u = (px.x / uRes.x * 2.0 - 1.0) * uTanHalf * uAspect;
  float v = (px.y / uRes.y * 2.0 - 1.0) * uTanHalf;
  vec3 dir = normalize(uCamF + u * uCamR + v * uCamU);
  float pix = 1.3 * uTanHalf / uRes.y;
  vec3 col = (uFlags & F_KERR) != 0 ? traceKerr(uCamPos, dir, seed, pix) : traceSchwarzschild(uCamPos, dir, seed, pix);
  outColor = vec4(min(col, vec3(60.0)), 1.0);
}`;

// Helligkeitsauszug + Verkleinerung für das Leuchten (Bloom)
export const BRIGHT_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uSrc; uniform vec2 uTexel;
void main() {
  vec3 c = vec3(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) c += texture(uSrc, vUv + vec2(float(x), float(y)) * uTexel * 1.5).rgb;
  c /= 9.0;
  float l = max(max(c.r, c.g), c.b);
  o = vec4(c * smoothstep(1.2, 3.5, l), 1.0);
}`;

export const BLUR_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uSrc; uniform vec2 uDir;
void main() {
  vec3 c = texture(uSrc, vUv).rgb * 0.227;
  c += (texture(uSrc, vUv + uDir * 1.385).rgb + texture(uSrc, vUv - uDir * 1.385).rgb) * 0.316;
  c += (texture(uSrc, vUv + uDir * 3.231).rgb + texture(uSrc, vUv - uDir * 3.231).rgb) * 0.070;
  o = vec4(c, 1.0);
}`;

// Zusammensetzen: Bloom, Belichtung, ACES-Tonemapping, Vignette, feines Korn
export const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uHdr, uBloom; uniform float uExposure, uBloomAmt, uTime; uniform int uHasBloom;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec3 c = texture(uHdr, vUv).rgb;
  if (uHasBloom == 1) c += texture(uBloom, vUv).rgb * uBloomAmt;
  c = aces(c * uExposure);
  vec2 q = vUv - 0.5;
  c *= 1.0 - 0.35 * dot(q, q) * 2.0;
  c = pow(c, vec3(1.0 / 2.2));
  float g = fract(sin(dot(gl_FragCoord.xy + uTime * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
  c += (g - 0.5) / 255.0 * step(0.004, c);
  o = vec4(c, 1.0);
}`;
