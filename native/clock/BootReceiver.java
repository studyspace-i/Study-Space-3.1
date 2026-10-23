package in.mrharshit.studyspace.clock;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** After a reboot, app update or clock change: put every alarm and the timer back. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        ClockScheduler.scheduleAll(context);
        TimerNotifier.restore(context);
    }
}
