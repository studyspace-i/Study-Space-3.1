package in.mrharshit.studyspace.clock;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONObject;

/** The timer / stopwatch card in the notification panel: it keeps counting by itself, even when the app is closed. */
public final class TimerNotifier {
    public static final String CH = "studyclock_timer";
    public static final int ID_TIMER = 7101;
    public static final int ID_WATCH = 7102;
    private TimerNotifier() {}

    private static int flags() {
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;
        return f;
    }

    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CH) != null) return;
        NotificationChannel ch = new NotificationChannel(CH, "Timer and stopwatch", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Shows your running timer or stopwatch");
        ch.setShowBadge(false);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    private static int smallIcon(Context c) {
        int id = c.getResources().getIdentifier("ic_stat_notify", "drawable", c.getPackageName());
        return id != 0 ? id : c.getApplicationInfo().icon;
    }

    private static PendingIntent openApp(Context c) {
        Intent launch = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (launch == null) launch = new Intent();
        return PendingIntent.getActivity(c, 2, launch, flags());
    }

    private static PendingIntent action(Context c, String act, int rc) {
        Intent i = new Intent(c, RingService.class);
        i.setAction(act);
        return PendingIntent.getService(c, rc, i, flags());
    }

    public static final int ID_TIMER_BASE = 7200;

    /** Countdown that ticks in the notification panel (also on the lock screen). One card per timer. */
    public static void showTimer(Context c, int id, long endMillis, String label, boolean running, long leftMillis) {
        ensureChannel(c);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CH) : new Notification.Builder(c);
        b.setSmallIcon(smallIcon(c));
        b.setContentTitle(label == null || label.length() == 0 ? "Timer" : label);
        b.setOngoing(true);
        b.setOnlyAlertOnce(true);
        b.setCategory(Notification.CATEGORY_PROGRESS);
        if (Build.VERSION.SDK_INT >= 21) b.setVisibility(Notification.VISIBILITY_PUBLIC);
        b.setContentIntent(openApp(c));
        if (running) {
            b.setContentText("Time left");
            b.setWhen(endMillis);
            b.setShowWhen(true);
            b.setUsesChronometer(true);
            if (Build.VERSION.SDK_INT >= 24) b.setChronometerCountDown(true);
        } else {
            long s = Math.max(0, leftMillis / 1000);
            b.setContentText("Paused · " + (s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60) + " left");
            b.setShowWhen(false);
        }
        Intent i = new Intent(c, RingService.class);
        i.setAction(RingService.ACTION_CANCEL_TIMER);
        i.putExtra("timerId", id);
        b.addAction(0, "Cancel", PendingIntent.getService(c, 3100 + id, i, flags()));
        nm.notify(ID_TIMER_BASE + id, b.build());
    }

    public static void showStopwatch(Context c, long startMillis) {
        ensureChannel(c);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CH) : new Notification.Builder(c);
        b.setSmallIcon(smallIcon(c));
        b.setContentTitle("Stopwatch");
        b.setContentText("Running");
        b.setOngoing(true);
        b.setOnlyAlertOnce(true);
        b.setWhen(startMillis);
        b.setShowWhen(true);
        b.setUsesChronometer(true);
        b.setCategory(Notification.CATEGORY_PROGRESS);
        if (Build.VERSION.SDK_INT >= 21) b.setVisibility(Notification.VISIBILITY_PUBLIC);
        b.setContentIntent(openApp(c));
        nm.notify(ID_WATCH, b.build());
    }

    public static void clearTimer(Context c, int id) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(ID_TIMER_BASE + id);
    }

    public static void clearStopwatch(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(ID_WATCH);
    }

    /** Re-draw every timer card from the stored list (after a reboot or when the app syncs). */
    public static void restore(Context c) {
        try {
            org.json.JSONArray arr = ClockStore.timers(c);
            long now = System.currentTimeMillis();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o == null) continue;
                int id = o.optInt("id", -1);
                if (id < 0) continue;
                if (o.optBoolean("running", false) && o.optLong("end", 0) > now) showTimer(c, id, o.optLong("end", 0), o.optString("label", ""), true, 0);
                else if (!o.optBoolean("running", false) && o.optBoolean("show", false) && o.optLong("left", 0) > 0) showTimer(c, id, 0, o.optString("label", ""), false, o.optLong("left", 0));
                else clearTimer(c, id);
            }
            ClockScheduler.scheduleTimers(c);
        } catch (Exception ignored) { }
    }
}
