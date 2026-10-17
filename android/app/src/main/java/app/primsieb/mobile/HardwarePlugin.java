package app.primsieb.mobile;

import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Environment;
import android.os.PowerManager;
import android.os.StatFs;
import android.util.DisplayMetrics;
import android.view.Display;
import android.view.WindowManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.FileReader;

/**
 * Liest Hardware-Daten für den Geräte-Check aus – ohne Berechtigungen und ohne Internet:
 * Chip, Taktraten je Kern, Arbeitsspeicher, Speicherplatz, Akku, Display, Temperaturstatus, Kameras, Sensoren.
 */
@CapacitorPlugin(name = "Hardware")
public class HardwarePlugin extends Plugin {

    private static String readLine(String path) {
        try (BufferedReader r = new BufferedReader(new FileReader(path))) {
            String s = r.readLine();
            return s == null ? null : s.trim();
        } catch (Exception e) {
            return null;
        }
    }

    private static long readLong(String path) {
        String s = readLine(path);
        if (s == null) return -1;
        try { return Long.parseLong(s); } catch (Exception e) { return -1; }
    }

    @PluginMethod
    public void info(PluginCall call) {
        Context ctx = getContext();
        JSObject o = new JSObject();
        o.put("manufacturer", Build.MANUFACTURER);
        o.put("brand", Build.BRAND);
        o.put("model", Build.MODEL);
        o.put("device", Build.DEVICE);
        o.put("board", Build.BOARD);
        o.put("hardware", Build.HARDWARE);
        o.put("android", Build.VERSION.RELEASE);
        o.put("sdk", Build.VERSION.SDK_INT);
        if (Build.VERSION.SDK_INT >= 31) {
            o.put("socManufacturer", Build.SOC_MANUFACTURER);
            o.put("socModel", Build.SOC_MODEL);
        }

        // CPU: maximale Taktrate je Kern (ergibt die Cluster: groß / mittel / klein)
        int n = Runtime.getRuntime().availableProcessors();
        JSArray maxF = new JSArray();
        for (int i = 0; i < n; i++) maxF.put(readLong("/sys/devices/system/cpu/cpu" + i + "/cpufreq/cpuinfo_max_freq"));
        o.put("cores", n);
        o.put("maxFreqKHz", maxF);

        // Arbeitsspeicher
        ActivityManager am = (ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        am.getMemoryInfo(mi);
        o.put("ramTotal", mi.totalMem);
        o.put("ramAvail", mi.availMem);
        o.put("appMemMB", am.getLargeMemoryClass());

        // Speicherplatz
        try {
            StatFs fs = new StatFs(Environment.getDataDirectory().getPath());
            o.put("storageTotal", fs.getTotalBytes());
            o.put("storageFree", fs.getAvailableBytes());
        } catch (Exception ignored) { }

        // Display
        try {
            WindowManager wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
            Display d = wm.getDefaultDisplay();
            DisplayMetrics dm = new DisplayMetrics();
            d.getRealMetrics(dm);
            o.put("screenW", dm.widthPixels);
            o.put("screenH", dm.heightPixels);
            o.put("dpi", dm.densityDpi);
            float maxHz = d.getRefreshRate();
            for (Display.Mode m : d.getSupportedModes()) maxHz = Math.max(maxHz, m.getRefreshRate());
            o.put("refreshMax", maxHz);
            o.put("refreshNow", d.getRefreshRate());
            o.put("hdr", d.isHdr());
        } catch (Exception ignored) { }

        // Kameras (Auflisten braucht keine Kamera-Berechtigung)
        try {
            CameraManager cm = (CameraManager) ctx.getSystemService(Context.CAMERA_SERVICE);
            // Logische Mehrfachkameras bestehen aus mehreren physischen Kameras → die physischen zählen
            java.util.Set<String> backIds = new java.util.HashSet<>(), frontIds = new java.util.HashSet<>();
            for (String id : cm.getCameraIdList()) {
                CameraCharacteristics ch = cm.getCameraCharacteristics(id);
                Integer f = ch.get(CameraCharacteristics.LENS_FACING);
                boolean isFront = f != null && f == CameraCharacteristics.LENS_FACING_FRONT;
                java.util.Set<String> phys = Build.VERSION.SDK_INT >= 28 ? ch.getPhysicalCameraIds() : java.util.Collections.emptySet();
                if (phys.isEmpty()) (isFront ? frontIds : backIds).add(id);
                else for (String pid : phys) (isFront ? frontIds : backIds).add(pid);
            }
            int back = backIds.size(), front = frontIds.size();
            o.put("camBack", back);
            o.put("camFront", front);
        } catch (Exception ignored) { }

        // Sensoren
        try {
            SensorManager sm = (SensorManager) ctx.getSystemService(Context.SENSOR_SERVICE);
            JSArray s = new JSArray();
            int[] types = { Sensor.TYPE_ACCELEROMETER, Sensor.TYPE_GYROSCOPE, Sensor.TYPE_MAGNETIC_FIELD, Sensor.TYPE_PRESSURE,
                    Sensor.TYPE_PROXIMITY, Sensor.TYPE_LIGHT, Sensor.TYPE_STEP_COUNTER };
            String[] names = { "accel", "gyro", "magnet", "baro", "proximity", "light", "steps" };
            for (int i = 0; i < types.length; i++) if (sm.getDefaultSensor(types[i]) != null) s.put(names[i]);
            o.put("sensors", s);
            o.put("sensorCount", sm.getSensorList(Sensor.TYPE_ALL).size());
        } catch (Exception ignored) { }

        o.put("battery", battery());
        o.put("thermal", thermal());
        call.resolve(o);
    }

    /** Live-Werte während der Messung: aktuelle Taktraten, Akku, Temperaturstatus. */
    @PluginMethod
    public void live(PluginCall call) {
        JSObject o = new JSObject();
        int n = Runtime.getRuntime().availableProcessors();
        JSArray cur = new JSArray();
        for (int i = 0; i < n; i++) cur.put(readLong("/sys/devices/system/cpu/cpu" + i + "/cpufreq/scaling_cur_freq"));
        o.put("curFreqKHz", cur);
        o.put("battery", battery());
        o.put("thermal", thermal());
        call.resolve(o);
    }

    private JSObject battery() {
        JSObject b = new JSObject();
        Intent i = null;
        try {
            i = getContext().registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            if (i != null) {
                int level = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1), scale = i.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
                b.put("level", scale > 0 ? level * 100 / scale : -1);
                b.put("tempC", i.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -10000) / 10.0);
                b.put("voltage", i.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1));
                b.put("plugged", i.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0);
                b.put("health", i.getIntExtra(BatteryManager.EXTRA_HEALTH, 1));
                b.put("technology", i.getStringExtra(BatteryManager.EXTRA_TECHNOLOGY));
            }
            BatteryManager bm = (BatteryManager) getContext().getSystemService(Context.BATTERY_SERVICE);
            b.put("currentUA", bm.getLongProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW));
            long charge = bm.getLongProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER);
            b.put("chargeUAh", charge);
            // Werkskapazität (Systemprofil des Herstellers, mAh)
            double design = designCapacity();
            if (design > 0) b.put("designMah", design);
            if (i != null && Build.VERSION.SDK_INT >= 34) {
                int cycles = i.getIntExtra(BatteryManager.EXTRA_CYCLE_COUNT, -1);
                if (cycles >= 0) b.put("cycles", cycles);
            }
        } catch (Exception ignored) { }
        return b;
    }

    private double designCapacity() {
        try {
            Class<?> c = Class.forName("com.android.internal.os.PowerProfile");
            Object pp = c.getConstructor(Context.class).newInstance(getContext());
            Object v = c.getMethod("getBatteryCapacity").invoke(pp);
            return v instanceof Double ? (Double) v : -1;
        } catch (Throwable t) {
            return -1;
        }
    }

    private JSObject thermal() {
        JSObject t = new JSObject();
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (Build.VERSION.SDK_INT >= 29) t.put("status", pm.getCurrentThermalStatus());
            if (Build.VERSION.SDK_INT >= 30) t.put("headroom", pm.getThermalHeadroom(0));
            t.put("powerSave", pm.isPowerSaveMode());
        } catch (Exception ignored) { }
        return t;
    }
}
