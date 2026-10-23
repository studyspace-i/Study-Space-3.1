package in.mrharshit.studyspace.clock;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/** Arms Android "alarm clock" alarms: exact, work in Doze, show the alarm icon in the status bar. */
public final class ClockScheduler {
    public static final String KIND_ALARM = "alarm";
    public static final String KIND_TIMER = "timer";
    public static final String KIND_SNOOZE = "snooze";
    private static final int RC_ALARM = 10000;
    public static final int RC_TIMER = 9100;   // + timer id
    public static final int RC_SNOOZE = 9002;
    private ClockScheduler() {}

    private static int flags() {
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;
        return f;
    }

    private static PendingIntent opIntent(Context c, int rc, String kind, int alarmId) {
        Intent i = new Intent(c, AlarmReceiver.class);
        i.setAction("in.mrharshit.studyspace.clock.FIRE." + rc);
        i.putExtra("kind", kind);
        i.putExtra("alarmId", alarmId);
        return PendingIntent.getBroadcast(c, rc, i, flags());
    }

    private static PendingIntent showIntent(Context c) {
        Intent launch = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (launch == null) launch = new Intent();
        return PendingIntent.getActivity(c, 1, launch, flags());
    }

    public static void armAt(Context c, int rc, String kind, int alarmId, long when) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent op = opIntent(c, rc, kind, alarmId);
        try {
            if (Build.VERSION.SDK_INT >= 21) {
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(when, showIntent(c)), op);
            } else {
                am.set(AlarmManager.RTC_WAKEUP, when, op);
            }
        } catch (Exception e) {
            try { am.set(AlarmManager.RTC_WAKEUP, when, op); } catch (Exception ignored) { }
        }
    }

    public static void disarm(Context c, int rc, String kind, int alarmId) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try { am.cancel(opIntent(c, rc, kind, alarmId)); } catch (Exception ignored) { }
    }

    /** Re-arms every enabled alarm (called after the list changes, after boot and after an alarm rings). */
    public static void scheduleAll(Context c) {
        JSONArray arr = ClockStore.alarms(c);
        long now = System.currentTimeMillis();
        for (int i = 0; i < arr.length(); i++) {
            JSONObject a = arr.optJSONObject(i);
            if (a == null) continue;
            int id = a.optInt("id", -1);
            if (id < 0) continue;
            int rc = RC_ALARM + id;
            disarm(c, rc, KIND_ALARM, id);
            long t = ClockStore.nextTrigger(a, now);
            if (t > 0) armAt(c, rc, KIND_ALARM, id, t);
        }
    }

    public static void cancelAll(Context c) {
        JSONArray arr = ClockStore.alarms(c);
        for (int i = 0; i < arr.length(); i++) {
            JSONObject a = arr.optJSONObject(i);
            if (a != null) disarm(c, RC_ALARM + a.optInt("id", -1), KIND_ALARM, a.optInt("id", -1));
        }
    }

    public static void snooze(Context c, int minutes, int alarmId) {
        armAt(c, RC_SNOOZE, KIND_SNOOZE, alarmId, System.currentTimeMillis() + minutes * 60000L);
    }

    /** Arms every running timer; timers that are not running are disarmed. */
    public static void scheduleTimers(Context c) {
        JSONArray arr = ClockStore.timers(c);
        long now = System.currentTimeMillis();
        for (int i = 0; i < arr.length(); i++) {
            JSONObject t = arr.optJSONObject(i);
            if (t == null) continue;
            int id = t.optInt("id", -1);
            if (id < 0) continue;
            disarm(c, RC_TIMER + id, KIND_TIMER, id);
            if (t.optBoolean("running", false) && t.optLong("end", 0) > now) armAt(c, RC_TIMER + id, KIND_TIMER, id, t.optLong("end", 0));
        }
    }

    public static void disarmTimer(Context c, int id) { disarm(c, RC_TIMER + id, KIND_TIMER, id); }
}
