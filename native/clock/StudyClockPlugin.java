package in.mrharshit.studyspace.clock;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;

/** Bridge between the app screens and the phone's own alarm engine. */
@CapacitorPlugin(name = "StudyClock")
public class StudyClockPlugin extends Plugin {

    private Context ctx() { return getContext(); }

    @PluginMethod
    public void getInfo(PluginCall call) {
        JSObject r = new JSObject();
        r.put("native", true);
        r.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(r);
    }

    /** Replace the whole alarm list (JSON text). The phone re-arms every alarm itself. */
    @PluginMethod
    public void setAlarms(PluginCall call) {
        try {
            String json = call.getString("alarms", "[]");
            ClockScheduler.cancelAll(ctx());
            ClockStore.setAlarmsJson(ctx(), json);
            ClockScheduler.scheduleAll(ctx());
            call.resolve();
        } catch (Exception e) { call.reject("failed"); }
    }

    @PluginMethod
    public void getAlarms(PluginCall call) {
        JSObject r = new JSObject();
        r.put("alarms", ClockStore.getAlarmsJson(ctx()));
        call.resolve(r);
    }

    /** Replace the whole timer list (JSON text). Running timers are armed and shown in the notification panel. */
    @PluginMethod
    public void setTimers(PluginCall call) {
        try {
            String json = call.getString("timers", "[]");
            org.json.JSONArray old = ClockStore.timers(ctx());
            for (int i = 0; i < old.length(); i++) {
                JSONObject o = old.optJSONObject(i);
                if (o == null) continue;
                ClockScheduler.disarmTimer(ctx(), o.optInt("id", -1));
                TimerNotifier.clearTimer(ctx(), o.optInt("id", -1));
            }
            ClockStore.setTimersJson(ctx(), json);
            TimerNotifier.restore(ctx());
            call.resolve();
        } catch (Exception e) { call.reject("failed"); }
    }

    @PluginMethod
    public void getTimers(PluginCall call) {
        JSObject r = new JSObject();
        r.put("timers", ClockStore.getTimersJson(ctx()));
        call.resolve(r);
    }

    @PluginMethod
    public void startStopwatch(PluginCall call) {
        long start = call.getLong("start", System.currentTimeMillis());
        TimerNotifier.showStopwatch(ctx(), start);
        call.resolve();
    }

    @PluginMethod
    public void stopStopwatch(PluginCall call) {
        TimerNotifier.clearStopwatch(ctx());
        call.resolve();
    }

    /** Save a sound the user picked from their files so the alarm can play it with the app closed. */
    @PluginMethod
    public void saveSound(PluginCall call) {
        try {
            String id = call.getString("id", "").replaceAll("[^A-Za-z0-9_-]", "");
            String data = call.getString("data", "");
            if (id.length() == 0 || data.length() == 0) { call.reject("empty"); return; }
            File dir = new File(ctx().getFilesDir(), "sounds");
            if (!dir.exists()) dir.mkdirs();
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            FileOutputStream out = new FileOutputStream(new File(dir, id));
            out.write(bytes);
            out.close();
            call.resolve();
        } catch (Exception e) { call.reject("failed"); }
    }

    @PluginMethod
    public void checkAccess(PluginCall call) {
        JSObject r = new JSObject();
        boolean full = true;
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                android.app.NotificationManager nm = (android.app.NotificationManager) ctx().getSystemService(Context.NOTIFICATION_SERVICE);
                full = nm != null && nm.canUseFullScreenIntent();
            } catch (Exception ignored) { }
        }
        r.put("fullScreen", full);
        boolean batt = false;
        try {
            PowerManager pm = (PowerManager) ctx().getSystemService(Context.POWER_SERVICE);
            batt = pm != null && pm.isIgnoringBatteryOptimizations(ctx().getPackageName());
        } catch (Exception ignored) { }
        r.put("batteryUnrestricted", batt);
        call.resolve(r);
    }

    @PluginMethod
    public void openFullScreenSettings(PluginCall call) {
        try {
            Intent i = new Intent("android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT", Uri.parse("package:" + ctx().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx().startActivity(i);
        } catch (Exception e) { /* older phones don't have this screen */ }
        call.resolve();
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        try {
            Intent i = new Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + ctx().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx().startActivity(i);
        } catch (Exception e) {
            try {
                Intent j = new Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                j.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx().startActivity(j);
            } catch (Exception ignored) { }
        }
        call.resolve();
    }
}
