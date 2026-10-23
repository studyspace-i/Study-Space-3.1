package in.mrharshit.studyspace.clock;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONObject;

/** Wakes up when an alarm / timer is due and starts the ringing service. */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String kind = intent.getStringExtra("kind");
        int id = intent.getIntExtra("alarmId", -1);
        Intent s = new Intent(context, RingService.class);
        s.setAction(RingService.ACTION_RING);
        s.putExtra("kind", kind == null ? ClockScheduler.KIND_ALARM : kind);
        s.putExtra("alarmId", id);
        try {
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(s); else context.startService(s);
        } catch (Exception ignored) { }

        if (ClockScheduler.KIND_ALARM.equals(kind)) {
            try {
                JSONObject o = ClockStore.findAlarm(context, id);
                if (o != null) {
                    long now = System.currentTimeMillis();
                    boolean changed = false;
                    if (o.optLong("skipTo", 0) > 0 && o.optLong("skipTo", 0) <= now) { o.remove("skipTo"); changed = true; }
                    boolean once = "once".equals(ClockStore.scheduleOf(o));
                    if (once || ClockStore.nextTrigger(o, now + 60000) < 0) { o.put("on", false); changed = true; }
                    if (changed) ClockStore.updateAlarm(context, o);
                }
            } catch (Exception ignored) { }
            ClockScheduler.scheduleAll(context);
        }
        if (ClockScheduler.KIND_TIMER.equals(kind)) {
            try {
                JSONObject t = ClockStore.findTimer(context, id);
                if (t != null) {
                    t.put("running", false); t.put("done", true); t.put("left", 0); t.put("end", 0);
                    ClockStore.updateTimer(context, t);
                }
            } catch (Exception ignored) { }
            TimerNotifier.clearTimer(context, id);
        }
    }
}
