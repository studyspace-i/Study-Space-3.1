package in.mrharshit.studyspace.clock;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Vibrator;

import org.json.JSONObject;

import java.util.HashMap;

import java.io.File;

/** Plays the alarm sound, vibrates and shows the full-screen alarm until the user stops it. */
public class RingService extends Service {
    public static final String ACTION_RING = "in.mrharshit.studyspace.clock.RING";
    public static final String ACTION_STOP = "in.mrharshit.studyspace.clock.STOP";
    public static final String ACTION_SNOOZE = "in.mrharshit.studyspace.clock.SNOOZE";
    public static final String ACTION_CANCEL_TIMER = "in.mrharshit.studyspace.clock.CANCEL_TIMER";
    public static final String ACTION_ADD_MIN = "in.mrharshit.studyspace.clock.ADD_MIN";
    private static final HashMap<Integer, Integer> SNOOZED = new HashMap<Integer, Integer>();
    private static final String CH = "studyclock_ring";
    private static final int NID = 7001;

    private MediaPlayer player;
    private Vibrator vibrator;
    private final Handler handler = new Handler();
    private int alarmId = -1;
    private String kind = ClockScheduler.KIND_ALARM;
    private String label = "";
    private int snoozeMin = 5;
    private int riseSec = 0;
    private float vol = 1f;
    private String tasks = "";
    private boolean delAfter = false;
    private final Runnable riser = new Runnable() {
        @Override public void run() {
            if (player == null || riseSec <= 0) return;
            vol = Math.min(1f, vol + 1f / Math.max(1, riseSec));
            try { player.setVolume(vol, vol); } catch (Exception ignored) { }
            if (vol < 1f) handler.postDelayed(this, 1000);
        }
    };
    private final Runnable autoStop = new Runnable() {
        @Override public void run() { stopRinging(true); }
    };

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String act = intent == null ? null : intent.getAction();
        if (ACTION_STOP.equals(act)) { finishAlarm(); SNOOZED.remove(alarmId); stopRinging(false); return START_NOT_STICKY; }
        if (ACTION_SNOOZE.equals(act)) {
            Integer n = SNOOZED.get(alarmId);
            SNOOZED.put(alarmId, n == null ? 1 : n + 1);
            ClockScheduler.snooze(this, snoozeMin <= 0 ? 5 : snoozeMin, alarmId);
            stopRinging(false);
            return START_NOT_STICKY;
        }
        if (ACTION_ADD_MIN.equals(act)) {
            try {
                JSONObject t = ClockStore.findTimer(this, alarmId);
                if (t != null) {
                    long end = System.currentTimeMillis() + 60000L;
                    t.put("running", true); t.put("done", false); t.put("end", end); t.put("left", 60000L); t.put("dur", 60000L); t.put("show", true);
                    ClockStore.updateTimer(this, t);
                    ClockScheduler.armAt(this, ClockScheduler.RC_TIMER + alarmId, ClockScheduler.KIND_TIMER, alarmId, end);
                    TimerNotifier.showTimer(this, alarmId, end, t.optString("label", ""), true, 0);
                }
            } catch (Exception ignored) { }
            stopRinging(false);
            return START_NOT_STICKY;
        }
        if (ACTION_CANCEL_TIMER.equals(act)) {
            int tid = intent.getIntExtra("timerId", -1);
            ClockScheduler.disarmTimer(this, tid);
            try {
                JSONObject t = ClockStore.findTimer(this, tid);
                if (t != null) { t.put("running", false); t.put("done", false); t.put("show", false); t.put("left", t.optLong("dur", 0)); t.put("end", 0); ClockStore.updateTimer(this, t); }
            } catch (Exception ignored) { }
            TimerNotifier.clearTimer(this, tid);
            if (player == null) stopSelf();
            return START_NOT_STICKY;
        }
        if (intent != null) {
            kind = intent.getStringExtra("kind") == null ? ClockScheduler.KIND_ALARM : intent.getStringExtra("kind");
            alarmId = intent.getIntExtra("alarmId", -1);
        }
        String sound = "chime";
        boolean vibrate = true;
        label = "";
        boolean canSnooze = true;
        boolean important = false;
        riseSec = 0; tasks = ""; delAfter = false; vol = 1f;
        if (ClockScheduler.KIND_TIMER.equals(kind)) {
            JSONObject t = ClockStore.findTimer(this, alarmId);
            label = t == null ? "Timer" : t.optString("label", "Timer");
            sound = t == null ? "bell" : t.optString("sound", "bell");
            vibrate = t == null || t.optBoolean("vibrate", true);
            riseSec = t == null ? 0 : t.optInt("rise", 0);
            canSnooze = false;
        } else {
            JSONObject a = ClockStore.findAlarm(this, alarmId);
            if (a != null) {
                label = a.optString("label", "Alarm");
                sound = a.optString("sound", "chime");
                vibrate = a.optBoolean("vibrate", true);
                canSnooze = a.optBoolean("snooze", true);
                snoozeMin = a.optInt("snoozeMin", 5);
                important = a.optBoolean("important", false);
                riseSec = a.optInt("rise", 0);
                delAfter = a.optBoolean("del", false);
                org.json.JSONArray tk = a.optJSONArray("tasks");
                if (tk != null && tk.length() > 0) tasks = tk.toString();
                int max = a.optInt("maxSnooze", 0);
                Integer used = SNOOZED.get(alarmId);
                if (max > 0 && used != null && used >= max) canSnooze = false;
                if (important) { canSnooze = false; vibrate = true; if (tasks.length() == 0) tasks = "[{\"t\":\"math\",\"n\":1,\"d\":2}]"; }
                if (a.optBoolean("auto", false) && label.length() == 0) label = "Your shift is starting";
            }
        }
        if (label.length() == 0) label = ClockScheduler.KIND_TIMER.equals(kind) ? "Timer" : "Alarm";
        startForeground(NID, buildNotification(canSnooze));
        startSound(sound);
        if (riseSec > 0 && player != null) { vol = 0.05f; try { player.setVolume(vol, vol); } catch (Exception ignored) { } handler.removeCallbacks(riser); handler.postDelayed(riser, 1000); }
        if (vibrate) startVibration();
        handler.removeCallbacks(autoStop);
        handler.postDelayed(autoStop, (important ? 10 * 60 : 90) * 1000L);
        return START_NOT_STICKY;
    }

    private int flags() {
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;
        return f;
    }

    private Notification buildNotification(boolean canSnooze) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null && nm.getNotificationChannel(CH) == null) {
            NotificationChannel ch = new NotificationChannel(CH, "Alarm ringing", NotificationManager.IMPORTANCE_HIGH);
            ch.setSound(null, null);
            ch.enableVibration(false);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }
        Intent full = new Intent(this, RingActivity.class);
        full.putExtra("label", label);
        full.putExtra("kind", kind);
        full.putExtra("snooze", canSnooze);
        full.putExtra("snoozeMin", snoozeMin);
        full.putExtra("tasks", tasks);
        full.putExtra("alarmId", alarmId);
        full.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent fullPi = PendingIntent.getActivity(this, 11, full, flags());
        Intent stop = new Intent(this, RingService.class); stop.setAction(ACTION_STOP);
        Intent snz = new Intent(this, RingService.class); snz.setAction(ACTION_SNOOZE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CH) : new Notification.Builder(this);
        int icon = getResources().getIdentifier("ic_stat_notify", "drawable", getPackageName());
        b.setSmallIcon(icon != 0 ? icon : getApplicationInfo().icon);
        b.setContentTitle(ClockScheduler.KIND_TIMER.equals(kind) ? label + " ⏱" : label + " ⏰");
        b.setContentText(ClockScheduler.KIND_TIMER.equals(kind) ? "Time's up!" : "Tap to open · swipe to stop");
        b.setOngoing(true);
        b.setAutoCancel(false);
        b.setCategory(Notification.CATEGORY_ALARM);
        b.setPriority(Notification.PRIORITY_MAX);
        if (Build.VERSION.SDK_INT >= 21) b.setVisibility(Notification.VISIBILITY_PUBLIC);
        b.setFullScreenIntent(fullPi, true);
        b.setContentIntent(fullPi);
        if (tasks.length() == 0) b.addAction(0, "Stop", PendingIntent.getService(this, 12, stop, flags()));
        if (ClockScheduler.KIND_TIMER.equals(kind)) {
            Intent add = new Intent(this, RingService.class); add.setAction(ACTION_ADD_MIN);
            b.addAction(0, "+1 min", PendingIntent.getService(this, 14, add, flags()));
        }
        if (canSnooze) b.addAction(0, "Snooze", PendingIntent.getService(this, 13, snz, flags()));
        return b.build();
    }

    private void startSound(String sound) {
        try {
            player = new MediaPlayer();
            Uri uri = null;
            if (sound != null && sound.startsWith("file:")) {
                File f = new File(new File(getFilesDir(), "sounds"), sound.substring(5).replaceAll("[^A-Za-z0-9_-]", ""));
                if (f.exists()) uri = Uri.fromFile(f);
            } else if (sound != null && !sound.equals("default")) {
                int res = getResources().getIdentifier("alarm_" + sound, "raw", getPackageName());
                if (res != 0) uri = Uri.parse("android.resource://" + getPackageName() + "/" + res);
            }
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            player.setDataSource(this, uri);
            if (Build.VERSION.SDK_INT >= 21) {
                player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
            }
            player.setLooping(true);
            player.prepare();
            player.start();
        } catch (Exception e) {
            try { if (player != null) player.release(); } catch (Exception ignored) { }
            player = null;
        }
    }

    private void startVibration() {
        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null) vibrator.vibrate(new long[]{0, 600, 400}, 0);
        } catch (Exception ignored) { }
    }

    /** Dismissed: delete one-time alarms the user asked to auto-delete. */
    private void finishAlarm() {
        if (ClockScheduler.KIND_TIMER.equals(kind) || !delAfter) return;
        try {
            JSONObject a = ClockStore.findAlarm(this, alarmId);
            if (a != null && ("once".equals(ClockStore.scheduleOf(a)) || ClockStore.nextTrigger(a, System.currentTimeMillis()) < 0)) {
                ClockStore.removeAlarm(this, alarmId);
                ClockScheduler.disarm(this, 10000 + alarmId, ClockScheduler.KIND_ALARM, alarmId);
            }
        } catch (Exception ignored) { }
    }

    private void stopRinging(boolean missed) {
        handler.removeCallbacks(autoStop);
        handler.removeCallbacks(riser);
        try { if (player != null) { player.stop(); player.release(); } } catch (Exception ignored) { }
        player = null;
        try { if (vibrator != null) vibrator.cancel(); } catch (Exception ignored) { }
        Intent close = new Intent(RingActivity.ACTION_CLOSE);
        close.setPackage(getPackageName());
        sendBroadcast(close);
        stopForeground(true);
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(NID);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(autoStop);
        try { if (player != null) { player.release(); } } catch (Exception ignored) { }
        super.onDestroy();
    }
}
