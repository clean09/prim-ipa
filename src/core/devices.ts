// Geräte-Erkennung (offline): eigenes Android-Plugin „Hardware“ (echte Werte), Capacitor Device (Modellkennung, iOS),
// WebGL (GPU-Name) und eine eingebaute Datenbank für Chips und Modellnamen.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { gpuName } from '../gl/glutil';

export type Vendor = 'qualcomm' | 'google' | 'samsung' | 'mediatek' | 'apple' | 'intel' | 'amd' | 'nvidia' | 'other';
export interface Cluster { count: number; ghz: number; label: string }
export interface Soc { name: string; vendor: Vendor; node?: string; gpu: string; npu?: string; clusters?: Cluster[] }

export interface BatteryInfo {
  level?: number; tempC?: number; charging?: boolean; tech?: string;
  /** geschätzter Zustand in % der Werkskapazität */
  healthPct?: number; designMah?: number; estMah?: number; cycles?: number; status?: number;
}

/** Akkuzustand schätzen: Ladezähler ÷ Ladestand = aktuelle Vollkapazität, verglichen mit der Werkskapazität. */
export function batteryHealth(b: { level?: number; chargeUAh?: number; designMah?: number }): { pct?: number; est?: number } {
  if (!b.level || b.level < 5 || !b.chargeUAh || b.chargeUAh <= 0 || !b.designMah) return {};
  let est = b.chargeUAh / 1000 / (b.level / 100);
  // manche Hersteller melden mAh statt µAh
  if (est < b.designMah / 20) est *= 1000;
  if (est > b.designMah * 3) est /= 1000;
  const pct = (est / b.designMah) * 100;
  if (pct < 20 || pct > 130) return {};
  return { pct: Math.min(100, pct), est };
}

export interface DeviceProfile {
  name: string;
  maker: string;
  form: 'phone' | 'tablet' | 'pc';
  soc: Soc;
  cores: number;
  clusters: Cluster[];
  ramGB?: number;
  storageGB?: number;
  storageFreeGB?: number;
  screen?: { w: number; h: number; hz?: number; hdr?: boolean };
  battery?: BatteryInfo;
  cams?: { back: number; front: number };
  sensors?: string[];
  os: string;
  gpuRenderer: string;
  native: boolean;
  /** gemessene Maximaltakte je CPU-Index (Android) */
  maxFreqKHz?: number[];          // echte Werte aus dem Android-Plugin
}

interface HwBattery { level?: number; tempC?: number; plugged?: boolean; technology?: string; chargeUAh?: number; designMah?: number; cycles?: number; health?: number }
interface HwInfo {
  manufacturer?: string; brand?: string; model?: string; device?: string; board?: string; hardware?: string; android?: string; sdk?: number;
  socManufacturer?: string; socModel?: string; cores?: number; maxFreqKHz?: number[];
  ramTotal?: number; ramAvail?: number; storageTotal?: number; storageFree?: number;
  screenW?: number; screenH?: number; refreshMax?: number; hdr?: boolean;
  camBack?: number; camFront?: number; sensors?: string[];
  battery?: HwBattery;
  thermal?: { status?: number; headroom?: number; powerSave?: boolean };
}
export interface HwLive { curFreqKHz?: number[]; battery?: HwBattery & { currentUA?: number; voltage?: number }; thermal?: HwInfo['thermal'] }

const Hardware = registerPlugin<{ info(): Promise<HwInfo>; live(): Promise<HwLive> }>('Hardware');
const hasHw = () => Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('Hardware');

export async function liveHw(): Promise<HwLive | null> {
  if (!hasHw()) return null;
  try { return await Hardware.live(); } catch { return null; }
}

// ------------------------------------------------------------------------------------------- Chip-Datenbank
const C = (count: number, ghz: number, label: string): Cluster => ({ count, ghz, label });
interface SocEntry extends Soc { match: RegExp }
const SOCS: SocEntry[] = [
  // Qualcomm Snapdragon (SoC-Kennung, Plattform-Codename, GPU)
  { match: /SM8750|\bsun\b|Adreno \(TM\) 830/i, name: 'Snapdragon 8 Elite', vendor: 'qualcomm', node: '3 nm', gpu: 'Adreno 830', npu: 'Hexagon', clusters: [C(2, 4.32, 'Oryon Prime'), C(6, 3.53, 'Oryon')] },
  { match: /SM8650|pineapple|Adreno \(TM\) 750/i, name: 'Snapdragon 8 Gen 3', vendor: 'qualcomm', node: '4 nm', gpu: 'Adreno 750', npu: 'Hexagon', clusters: [C(1, 3.3, 'Cortex-X4'), C(5, 3.15, 'Cortex-A720'), C(2, 2.27, 'Cortex-A520')] },
  { match: /SM8635|cliffs|Adreno \(TM\) 735/i, name: 'Snapdragon 8s Gen 3', vendor: 'qualcomm', node: '4 nm', gpu: 'Adreno 735', npu: 'Hexagon', clusters: [C(1, 3.0, 'Cortex-X4'), C(4, 2.8, 'Cortex-A720'), C(3, 2.0, 'Cortex-A520')] },
  { match: /SM8550|kalama|Adreno \(TM\) 740/i, name: 'Snapdragon 8 Gen 2', vendor: 'qualcomm', node: '4 nm', gpu: 'Adreno 740', npu: 'Hexagon', clusters: [C(1, 3.2, 'Cortex-X3'), C(4, 2.8, 'Cortex-A715/A710'), C(3, 2.0, 'Cortex-A510')] },
  { match: /SM8475|cape/i, name: 'Snapdragon 8+ Gen 1', vendor: 'qualcomm', node: '4 nm', gpu: 'Adreno 730', npu: 'Hexagon', clusters: [C(1, 3.2, 'Cortex-X2'), C(3, 2.75, 'Cortex-A710'), C(4, 2.0, 'Cortex-A510')] },
  { match: /SM8450|taro|Adreno \(TM\) 730/i, name: 'Snapdragon 8 Gen 1', vendor: 'qualcomm', node: '4 nm', gpu: 'Adreno 730', npu: 'Hexagon', clusters: [C(1, 3.0, 'Cortex-X2'), C(3, 2.5, 'Cortex-A710'), C(4, 1.8, 'Cortex-A510')] },
  { match: /SM8350|lahaina|Adreno \(TM\) 660/i, name: 'Snapdragon 888', vendor: 'qualcomm', node: '5 nm', gpu: 'Adreno 660', npu: 'Hexagon 780', clusters: [C(1, 2.84, 'Cortex-X1'), C(3, 2.42, 'Cortex-A78'), C(4, 1.8, 'Cortex-A55')] },
  { match: /SM8250|kona|Adreno \(TM\) 650/i, name: 'Snapdragon 865', vendor: 'qualcomm', node: '7 nm', gpu: 'Adreno 650', npu: 'Hexagon 698', clusters: [C(1, 2.84, 'Cortex-A77'), C(3, 2.42, 'Cortex-A77'), C(4, 1.8, 'Cortex-A55')] },
  { match: /SM7675/i, name: 'Snapdragon 7+ Gen 3', vendor: 'qualcomm', node: '4 nm', gpu: 'Adreno 732', npu: 'Hexagon' },
  { match: /SM7475|Adreno \(TM\) 725/i, name: 'Snapdragon 7+ Gen 2', vendor: 'qualcomm', node: '4 nm', gpu: 'Adreno 725', npu: 'Hexagon', clusters: [C(1, 2.91, 'Cortex-X2'), C(3, 2.49, 'Cortex-A710'), C(4, 1.8, 'Cortex-A510')] },
  { match: /SM7550|Adreno \(TM\) 720/i, name: 'Snapdragon 7 Gen 3', vendor: 'qualcomm', node: '4 nm', gpu: 'Adreno 720', npu: 'Hexagon', clusters: [C(4, 2.63, 'Cortex-A715'), C(4, 1.8, 'Cortex-A510')] },
  { match: /SM7450|Adreno \(TM\) 662/i, name: 'Snapdragon 7 Gen 1', vendor: 'qualcomm', node: '4 nm', gpu: 'Adreno 662', npu: 'Hexagon' },
  { match: /SM7325|Adreno \(TM\) 642/i, name: 'Snapdragon 778G', vendor: 'qualcomm', node: '6 nm', gpu: 'Adreno 642L', npu: 'Hexagon 770', clusters: [C(4, 2.4, 'Cortex-A78'), C(4, 1.9, 'Cortex-A55')] },
  { match: /SM7435/i, name: 'Snapdragon 7s Gen 2', vendor: 'qualcomm', node: '4 nm', gpu: 'Adreno 710', clusters: [C(4, 2.4, 'Cortex-A78'), C(4, 1.95, 'Cortex-A55')] },
  { match: /SM6450|Adreno \(TM\) 710/i, name: 'Snapdragon 6 Gen 1', vendor: 'qualcomm', node: '4 nm', gpu: 'Adreno 710', clusters: [C(4, 2.2, 'Cortex-A78'), C(4, 1.8, 'Cortex-A55')] },
  { match: /SM6375|Adreno \(TM\) 619/i, name: 'Snapdragon 695', vendor: 'qualcomm', node: '6 nm', gpu: 'Adreno 619', clusters: [C(2, 2.2, 'Cortex-A78'), C(6, 1.7, 'Cortex-A55')] },
  // Google Tensor
  { match: /Tensor G5|laguna/i, name: 'Google Tensor G5', vendor: 'google', node: '3 nm', gpu: 'PowerVR', npu: 'TPU' },
  { match: /Tensor G4|zumapro/i, name: 'Google Tensor G4', vendor: 'google', node: '4 nm', gpu: 'Mali-G715 MP7', npu: 'TPU', clusters: [C(1, 3.1, 'Cortex-X4'), C(3, 2.6, 'Cortex-A720'), C(4, 1.92, 'Cortex-A520')] },
  { match: /Tensor G3|\bzuma\b/i, name: 'Google Tensor G3', vendor: 'google', node: '4 nm', gpu: 'Mali-G715 MP7', npu: 'TPU', clusters: [C(1, 2.91, 'Cortex-X3'), C(4, 2.37, 'Cortex-A715'), C(4, 1.7, 'Cortex-A510')] },
  { match: /Tensor G2|gs201/i, name: 'Google Tensor G2', vendor: 'google', node: '5 nm', gpu: 'Mali-G710 MP7', npu: 'TPU', clusters: [C(2, 2.85, 'Cortex-X1'), C(2, 2.35, 'Cortex-A78'), C(4, 1.8, 'Cortex-A55')] },
  { match: /\bTensor\b|gs101/i, name: 'Google Tensor', vendor: 'google', node: '5 nm', gpu: 'Mali-G78 MP20', npu: 'TPU', clusters: [C(2, 2.8, 'Cortex-X1'), C(2, 2.25, 'Cortex-A76'), C(4, 1.8, 'Cortex-A55')] },
  // Samsung Exynos
  { match: /s5e9945|Exynos ?2400|Xclipse 940/i, name: 'Exynos 2400', vendor: 'samsung', node: '4 nm', gpu: 'Xclipse 940', npu: 'NPU', clusters: [C(1, 3.2, 'Cortex-X4'), C(5, 2.9, 'Cortex-A720'), C(4, 1.95, 'Cortex-A520')] },
  { match: /s5e9925|Exynos ?2200|Xclipse 920/i, name: 'Exynos 2200', vendor: 'samsung', node: '4 nm', gpu: 'Xclipse 920', npu: 'NPU', clusters: [C(1, 2.8, 'Cortex-X2'), C(3, 2.5, 'Cortex-A710'), C(4, 1.8, 'Cortex-A510')] },
  { match: /s5e9840|Exynos ?2100/i, name: 'Exynos 2100', vendor: 'samsung', node: '5 nm', gpu: 'Mali-G78 MP14', npu: 'NPU', clusters: [C(1, 2.9, 'Cortex-X1'), C(3, 2.8, 'Cortex-A78'), C(4, 2.2, 'Cortex-A55')] },
  { match: /s5e8835|Exynos ?1380/i, name: 'Exynos 1380', vendor: 'samsung', node: '5 nm', gpu: 'Mali-G68 MP5', npu: 'NPU', clusters: [C(4, 2.4, 'Cortex-A78'), C(4, 2.0, 'Cortex-A55')] },
  // MediaTek
  { match: /MT6991|Dimensity ?9400|Immortalis-G925/i, name: 'Dimensity 9400', vendor: 'mediatek', node: '3 nm', gpu: 'Immortalis-G925', npu: 'APU', clusters: [C(1, 3.63, 'Cortex-X925'), C(3, 3.3, 'Cortex-X4'), C(4, 2.4, 'Cortex-A720')] },
  { match: /MT6989|Dimensity ?9300|Immortalis-G720/i, name: 'Dimensity 9300', vendor: 'mediatek', node: '4 nm', gpu: 'Immortalis-G720 MC12', npu: 'APU', clusters: [C(1, 3.25, 'Cortex-X4'), C(3, 2.85, 'Cortex-X4'), C(4, 2.0, 'Cortex-A720')] },
  { match: /MT6985|Dimensity ?9200|Immortalis-G715/i, name: 'Dimensity 9200', vendor: 'mediatek', node: '4 nm', gpu: 'Immortalis-G715 MC11', npu: 'APU', clusters: [C(1, 3.05, 'Cortex-X3'), C(3, 2.85, 'Cortex-A715'), C(4, 1.8, 'Cortex-A510')] },
  { match: /MT6983|Dimensity ?9000/i, name: 'Dimensity 9000', vendor: 'mediatek', node: '4 nm', gpu: 'Mali-G710 MC10', npu: 'APU', clusters: [C(1, 3.05, 'Cortex-X2'), C(3, 2.85, 'Cortex-A710'), C(4, 1.8, 'Cortex-A510')] },
  { match: /MT6878|Dimensity ?7300/i, name: 'Dimensity 7300', vendor: 'mediatek', node: '4 nm', gpu: 'Mali-G615 MC2', npu: 'APU', clusters: [C(4, 2.5, 'Cortex-A78'), C(4, 2.0, 'Cortex-A55')] },
  { match: /MT6789|Helio ?G99/i, name: 'Helio G99', vendor: 'mediatek', node: '6 nm', gpu: 'Mali-G57 MC2', clusters: [C(2, 2.2, 'Cortex-A76'), C(6, 2.0, 'Cortex-A55')] },
  // Apple
  { match: /^A18 Pro$/, name: 'Apple A18 Pro', vendor: 'apple', node: '3 nm', gpu: 'Apple GPU (6 Kerne)', npu: 'Neural Engine', clusters: [C(2, 4.05, 'Performance'), C(4, 2.42, 'Effizienz')] },
  { match: /^A18$/, name: 'Apple A18', vendor: 'apple', node: '3 nm', gpu: 'Apple GPU (5 Kerne)', npu: 'Neural Engine', clusters: [C(2, 4.04, 'Performance'), C(4, 2.2, 'Effizienz')] },
  { match: /^A17 Pro$/, name: 'Apple A17 Pro', vendor: 'apple', node: '3 nm', gpu: 'Apple GPU (6 Kerne)', npu: 'Neural Engine', clusters: [C(2, 3.78, 'Performance'), C(4, 2.11, 'Effizienz')] },
  { match: /^A16$/, name: 'Apple A16 Bionic', vendor: 'apple', node: '4 nm', gpu: 'Apple GPU (5 Kerne)', npu: 'Neural Engine', clusters: [C(2, 3.46, 'Performance'), C(4, 2.02, 'Effizienz')] },
  { match: /^A15$/, name: 'Apple A15 Bionic', vendor: 'apple', node: '5 nm', gpu: 'Apple GPU', npu: 'Neural Engine', clusters: [C(2, 3.23, 'Performance'), C(4, 2.02, 'Effizienz')] },
  { match: /^A14$/, name: 'Apple A14 Bionic', vendor: 'apple', node: '5 nm', gpu: 'Apple GPU (4 Kerne)', npu: 'Neural Engine', clusters: [C(2, 3.0, 'Performance'), C(4, 1.82, 'Effizienz')] },
  { match: /^A13$/, name: 'Apple A13 Bionic', vendor: 'apple', node: '7 nm', gpu: 'Apple GPU (4 Kerne)', npu: 'Neural Engine', clusters: [C(2, 2.65, 'Performance'), C(4, 1.8, 'Effizienz')] },
  { match: /^A12$/, name: 'Apple A12 Bionic', vendor: 'apple', node: '7 nm', gpu: 'Apple GPU (4 Kerne)', npu: 'Neural Engine', clusters: [C(2, 2.49, 'Performance'), C(4, 1.59, 'Effizienz')] },
];

// iPhone-Modellkennungen → [Name, Chip]
const IPHONES: Record<string, [string, string]> = {
  'iPhone11,2': ['iPhone XS', 'A12'], 'iPhone11,4': ['iPhone XS Max', 'A12'], 'iPhone11,6': ['iPhone XS Max', 'A12'], 'iPhone11,8': ['iPhone XR', 'A12'],
  'iPhone12,1': ['iPhone 11', 'A13'], 'iPhone12,3': ['iPhone 11 Pro', 'A13'], 'iPhone12,5': ['iPhone 11 Pro Max', 'A13'], 'iPhone12,8': ['iPhone SE (2. Gen.)', 'A13'],
  'iPhone13,1': ['iPhone 12 mini', 'A14'], 'iPhone13,2': ['iPhone 12', 'A14'], 'iPhone13,3': ['iPhone 12 Pro', 'A14'], 'iPhone13,4': ['iPhone 12 Pro Max', 'A14'],
  'iPhone14,4': ['iPhone 13 mini', 'A15'], 'iPhone14,5': ['iPhone 13', 'A15'], 'iPhone14,2': ['iPhone 13 Pro', 'A15'], 'iPhone14,3': ['iPhone 13 Pro Max', 'A15'], 'iPhone14,6': ['iPhone SE (3. Gen.)', 'A15'],
  'iPhone14,7': ['iPhone 14', 'A15'], 'iPhone14,8': ['iPhone 14 Plus', 'A15'], 'iPhone15,2': ['iPhone 14 Pro', 'A16'], 'iPhone15,3': ['iPhone 14 Pro Max', 'A16'],
  'iPhone15,4': ['iPhone 15', 'A16'], 'iPhone15,5': ['iPhone 15 Plus', 'A16'], 'iPhone16,1': ['iPhone 15 Pro', 'A17 Pro'], 'iPhone16,2': ['iPhone 15 Pro Max', 'A17 Pro'],
  'iPhone17,3': ['iPhone 16', 'A18'], 'iPhone17,4': ['iPhone 16 Plus', 'A18'], 'iPhone17,1': ['iPhone 16 Pro', 'A18 Pro'], 'iPhone17,2': ['iPhone 16 Pro Max', 'A18 Pro'], 'iPhone17,5': ['iPhone 16e', 'A18'],
};

// Samsung-Modellnummern → Verkaufsname
const SAMSUNG: [RegExp, string][] = [
  [/SM-S93[18]/, 'Galaxy S25'], [/SM-S936/, 'Galaxy S25+'], [/SM-S938/, 'Galaxy S25 Ultra'],
  [/SM-S921/, 'Galaxy S24'], [/SM-S926/, 'Galaxy S24+'], [/SM-S928/, 'Galaxy S24 Ultra'], [/SM-S721/, 'Galaxy S24 FE'],
  [/SM-S911/, 'Galaxy S23'], [/SM-S916/, 'Galaxy S23+'], [/SM-S918/, 'Galaxy S23 Ultra'], [/SM-S711/, 'Galaxy S23 FE'],
  [/SM-S901/, 'Galaxy S22'], [/SM-S906/, 'Galaxy S22+'], [/SM-S908/, 'Galaxy S22 Ultra'],
  [/SM-F956/, 'Galaxy Z Fold6'], [/SM-F741/, 'Galaxy Z Flip6'], [/SM-F946/, 'Galaxy Z Fold5'], [/SM-F731/, 'Galaxy Z Flip5'],
  [/SM-A556/, 'Galaxy A55'], [/SM-A546/, 'Galaxy A54'], [/SM-A356/, 'Galaxy A35'], [/SM-A346/, 'Galaxy A34'],
  [/SM-G78[01]/, 'Galaxy S20 FE'], [/SM-G98[01]/, 'Galaxy S20'], [/SM-G98[56]/, 'Galaxy S20+'], [/SM-G988/, 'Galaxy S20 Ultra'],
  [/SM-G99[01]/, 'Galaxy S21 FE'], [/SM-G991/, 'Galaxy S21'], [/SM-G996/, 'Galaxy S21+'], [/SM-G998/, 'Galaxy S21 Ultra'],
  [/SM-N98[01]/, 'Galaxy Note20'], [/SM-N98[56]/, 'Galaxy Note20 Ultra'], [/SM-N97/, 'Galaxy Note10'],
  [/SM-A52[05]/, 'Galaxy A52'], [/SM-A528/, 'Galaxy A52s'], [/SM-A536/, 'Galaxy A53'], [/SM-A72/, 'Galaxy A72'], [/SM-A51/, 'Galaxy A51'], [/SM-A71/, 'Galaxy A71'],
  [/SM-A256/, 'Galaxy A25'], [/SM-A155|SM-A156/, 'Galaxy A15'], [/SM-X\d/, 'Galaxy Tab'],
];

// Modellname → Chip (wenn das System den Chip nicht verrät, z. B. im Browser oder vor Android 12)
const MODEL_SOC: [RegExp, string][] = [
  [/Pixel 10/i, 'Tensor G5'], [/Pixel 9/i, 'Tensor G4'], [/Pixel 8/i, 'Tensor G3'], [/Pixel 7/i, 'Tensor G2'], [/Pixel 6/i, 'gs101'],
  [/SM-S93/i, 'SM8750'], [/SM-S92[168]/i, 'SM8650'], [/SM-S91/i, 'SM8550'], [/SM-F956|SM-F741/i, 'SM8650'], [/SM-F946|SM-F731/i, 'SM8550'],
  [/SM-A55|SM-A35/i, 'Exynos 1480'], [/SM-A54|SM-A34/i, 'Exynos 1380'],
];
const socFromModel = (m?: string) => { const e = m ? MODEL_SOC.find(([re]) => re.test(m)) : undefined; return e ? findSoc(e[1]) : null; };

// Rückkameras bekannter Modelle (Android meldet oft nur die „logischen“ Kameras)
const BACK_CAMS: [RegExp, number][] = [
  [/SM-G78[01]|SM-G98[01]|SM-G99[01]|SM-S90[16]|SM-S91[16]|SM-S92[16]|SM-S93[16]|SM-S711|SM-S721|SM-G991|SM-G996|SM-A54|SM-A55|SM-A35/i, 3],
  [/SM-G98[568]|SM-G998|SM-S908|SM-S918|SM-S928|SM-S938|SM-N98[56]|SM-A52|SM-A53|SM-A72/i, 4],
  [/Pixel \d+ Pro/i, 3], [/Pixel/i, 2],
];
const knownBackCams = (m: string) => BACK_CAMS.find(([re]) => re.test(m))?.[1] ?? 0;

function findSoc(...keys: (string | undefined)[]): Soc | null {
  for (const k of keys) {
    if (!k) continue;
    const e = SOCS.find(s => s.match.test(k));
    if (e) { const { match, ...soc } = e; void match; return soc; }
  }
  return null;
}

function vendorFromGpu(g: string): Vendor {
  if (/Adreno/i.test(g)) return 'qualcomm';
  if (/Xclipse/i.test(g)) return 'samsung';
  if (/Mali|Immortalis/i.test(g)) return 'mediatek';
  if (/Apple/i.test(g)) return 'apple';
  if (/Intel/i.test(g)) return 'intel';
  if (/AMD|Radeon/i.test(g)) return 'amd';
  if (/NVIDIA|GeForce|RTX/i.test(g)) return 'nvidia';
  return 'other';
}

/** Cluster aus den gemessenen Maximaltakten (Kerne mit gleichem Takt = ein Cluster). */
function clustersFromFreqs(f: number[]): Cluster[] {
  const valid = f.filter(x => x > 0);
  if (valid.length < f.length || !valid.length) return [];
  const groups = new Map<number, number>();
  for (const k of valid) { const ghz = Math.round(k / 1e4) / 100; groups.set(ghz, (groups.get(ghz) ?? 0) + 1); }
  const sorted = [...groups.entries()].sort((a, b) => b[0] - a[0]);
  const names = sorted.length === 1 ? ['Kerne'] : sorted.length === 2 ? ['Leistung', 'Effizienz'] : ['Prime', 'Leistung', 'Effizienz', 'Effizienz'];
  return sorted.map(([ghz, count], i) => C(count, ghz, names[Math.min(i, names.length - 1)]));
}

let cached: DeviceProfile | null = null;

export async function detectDevice(): Promise<DeviceProfile> {
  if (cached) return cached;
  let gpu = '';
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (gl) { gpu = gpuName(gl); gl.getExtension('WEBGL_lose_context')?.loseContext(); }
  } catch { /* egal */ }
  const cores = Math.max(1, navigator.hardwareConcurrency || 4);
  const plat = Capacitor.getPlatform();
  let info: any = {};
  try { info = await Device.getInfo(); } catch { /* Browser */ }

  if (hasHw()) {
    const hw = await Hardware.info().catch(() => ({} as HwInfo));
    const soc = findSoc(hw.socModel, hw.board, hw.hardware, gpu) ?? socFromModel(hw.model) ??
      { name: [hw.socManufacturer, hw.socModel].filter(Boolean).join(' ') || hw.hardware || 'SoC', vendor: vendorFromGpu(gpu), gpu: gpu || 'GPU' };
    const measured = clustersFromFreqs(hw.maxFreqKHz ?? []);
    const maker = cap(hw.manufacturer || 'Android');
    let model = hw.model || 'Android';
    if (/samsung/i.test(maker)) { const s = SAMSUNG.find(([re]) => re.test(model)); if (s) model = s[1] + ` (${model})`; }
    cached = {
      name: model.toLowerCase().startsWith(maker.toLowerCase()) ? model : `${maker} ${model}`, maker,
      form: Math.min(hw.screenW ?? 0, hw.screenH ?? 0) / ((hw as any).dpi ?? 400) * 160 >= 600 ? 'tablet' : 'phone',
      soc, cores: hw.cores ?? cores, clusters: measured.length ? measured : soc.clusters ?? [C(cores, 0, 'Kerne')],
      ramGB: hw.ramTotal ? hw.ramTotal / 2 ** 30 : undefined,
      storageGB: hw.storageTotal ? hw.storageTotal / 1e9 : undefined, storageFreeGB: hw.storageFree ? hw.storageFree / 1e9 : undefined,
      screen: hw.screenW ? { w: hw.screenW, h: hw.screenH!, hz: hw.refreshMax, hdr: hw.hdr } : undefined,
      battery: hw.battery ? (() => { const bh = batteryHealth(hw.battery!); return { level: hw.battery!.level, tempC: hw.battery!.tempC, charging: hw.battery!.plugged, tech: hw.battery!.technology,
        healthPct: bh.pct, estMah: bh.est, designMah: hw.battery!.designMah, cycles: hw.battery!.cycles, status: hw.battery!.health }; })() : undefined,
      cams: { back: Math.max(hw.camBack ?? 0, knownBackCams(hw.model ?? '')), front: hw.camFront ?? 0 }, sensors: hw.sensors ?? [],
      os: `Android ${hw.android ?? ''}`.trim(), gpuRenderer: gpu, native: true, maxFreqKHz: hw.maxFreqKHz,
    };
    return cached;
  }

  if (plat === 'ios') {
    const id: string = info.model ?? '';
    const known = IPHONES[id];
    const soc = (known && findSoc(known[1])) || { name: 'Apple-Chip', vendor: 'apple' as Vendor, gpu: 'Apple GPU', npu: 'Neural Engine' };
    let bat: DeviceProfile['battery'];
    try { const b = await Device.getBatteryInfo(); bat = { level: b.batteryLevel != null ? Math.round(b.batteryLevel * 100) : undefined, charging: b.isCharging }; } catch { /* egal */ }
    const isPad = /iPad/.test(id) || /iPad/.test(info.name ?? '');
    cached = {
      name: known ? known[0] : isPad ? 'iPad' : id.startsWith('iPhone') ? 'iPhone' : 'Apple-Gerät', maker: 'Apple', form: isPad ? 'tablet' : 'phone',
      soc, cores, clusters: soc.clusters ?? [C(cores, 0, 'Kerne')], screen: { w: Math.round(screen.width * devicePixelRatio), h: Math.round(screen.height * devicePixelRatio) },
      battery: bat, cams: known ? { back: /Pro/.test(known[0]) ? 3 : /SE|16e/.test(known[0]) ? 1 : 2, front: 1 } : undefined,
      os: `iOS ${info.osVersion ?? ''}`.trim(), gpuRenderer: gpu, native: false,
    };
    return cached;
  }

  // Browser (Entwicklung / PWA): so viel wie möglich aus dem Browser
  const ua = navigator.userAgent;
  const android = /Android [\d.]+; ([^;)]+?)(?: Build|\))/.exec(ua);
  const vendor = vendorFromGpu(gpu);
  const isPc = !android && !/iPhone|iPad/.test(ua);
  cached = {
    name: android ? android[1] : isPc ? (/Windows/.test(ua) ? 'Windows-PC' : /Mac/.test(ua) ? 'Mac' : 'Computer') : 'Gerät',
    maker: '', form: isPc ? 'pc' : 'phone',
    soc: (android ? socFromModel(android[1]) : null) ?? findSoc(gpu) ?? { name: isPc ? 'Prozessor' : 'SoC', vendor, gpu: gpu || 'GPU' },
    cores, clusters: [C(cores, 0, 'Kerne')], ramGB: (navigator as any).deviceMemory,
    screen: { w: Math.round(screen.width * devicePixelRatio), h: Math.round(screen.height * devicePixelRatio) },
    os: info.operatingSystem ?? 'Web', gpuRenderer: gpu, native: false,
  };
  return cached;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
