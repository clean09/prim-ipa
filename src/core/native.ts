// Handy-Funktionen: Bildschirm anlassen, Vibration, Teilen/Speichern von Dateien, Geräteinfos.
import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { settings } from './store';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();         // 'android' | 'ios' | 'web'

let awakeCount = 0;
let wakeLock: any = null;

/** Während einer Messung den Bildschirm anlassen (verschachtelbar). */
export async function stayAwake(on: boolean) {
  awakeCount = Math.max(0, awakeCount + (on ? 1 : -1));
  const want = awakeCount > 0 && settings().keepAwake;
  try {
    if (isNative) { if (want) await KeepAwake.keepAwake(); else await KeepAwake.allowSleep(); }
    else if ('wakeLock' in navigator) {
      if (want && !wakeLock) wakeLock = await (navigator as any).wakeLock.request('screen');
      if (!want && wakeLock) { await wakeLock.release(); wakeLock = null; }
    }
  } catch { /* nicht unterstützt */ }
}

export async function buzz(kind: 'success' | 'error' | 'light' = 'success') {
  if (!settings().haptics || !isNative) return;
  try {
    if (kind === 'light') await Haptics.selectionChanged();
    else await Haptics.notification({ type: kind === 'success' ? NotificationType.Success : NotificationType.Error });
  } catch { /* egal */ }
}

/** Textdatei teilen (nativ: Teilen-Dialog, Browser: Download). */
export async function shareFile(name: string, text: string, title: string) {
  if (isNative) {
    const res = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title, url: res.uri, dialogTitle: title });
    return;
  }
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function shareText(title: string, text: string) {
  try {
    if (isNative) await Share.share({ title, text, dialogTitle: title });
    else if (navigator.share) await navigator.share({ title, text });
    else await navigator.clipboard.writeText(text);
  } catch { /* abgebrochen */ }
}

export const cores = () => Math.max(1, navigator.hardwareConcurrency || 4);
export const memoryGB = () => (navigator as any).deviceMemory as number | undefined;

/** Gerätename aus dem User-Agent (so gut es geht). */
export function deviceName(): string {
  const ua = navigator.userAgent;
  const m = /Android [\d.]+; ([^;)]+?)(?: Build|\))/.exec(ua);
  if (m) return m[1].trim();
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad|Macintosh/.test(ua) && 'ontouchend' in document) return 'iPad';
  if (/Windows/.test(ua)) return 'Windows-PC';
  if (/Macintosh/.test(ua)) return 'Mac';
  return platform;
}
