package in.mrharshit.studyspace.clock;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.Locale;
import java.util.Random;

/** The full-screen alarm / timer that appears over the lock screen. Built in code, no web page involved. */
public class RingActivity extends Activity {
    public static final String ACTION_CLOSE = "in.mrharshit.studyspace.clock.CLOSE_RING";
    private TextView clock, dateTv;
    private FrameLayout stage;
    private LinearLayout ringView;
    private JSONArray tasks = new JSONArray();
    private int taskIndex = 0;
    private int alarmId = -1;
    private boolean timer = false;
    private final Random rnd = new Random();
    private final Handler handler = new Handler();
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            Date d = new Date();
            if (clock != null) clock.setText(new SimpleDateFormat("h:mm", Locale.getDefault()).format(d));
            if (dateTv != null) dateTv.setText(new SimpleDateFormat("EEEE, d MMMM", Locale.getDefault()).format(d));
            handler.postDelayed(this, 1000);
        }
    };
    private final BroadcastReceiver closer = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) { finish(); }
    };

    private int dp(int v) { return (int) (v * getResources().getDisplayMetrics().density + 0.5f); }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        String label = getIntent().getStringExtra("label");
        String kind = getIntent().getStringExtra("kind");
        boolean canSnooze = getIntent().getBooleanExtra("snooze", true);
        int snoozeMin = getIntent().getIntExtra("snoozeMin", 5);
        alarmId = getIntent().getIntExtra("alarmId", -1);
        timer = ClockScheduler.KIND_TIMER.equals(kind);
        try { String t = getIntent().getStringExtra("tasks"); if (t != null && t.length() > 0) tasks = new JSONArray(t); } catch (Exception ignored) { }

        stage = new FrameLayout(this);
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, timer ? new int[]{0xFF0F172A, 0xFF1E3A8A, 0xFF0E7490} : new int[]{0xFF1E1B4B, 0xFF312E81, 0xFF831843});
        stage.setBackground(bg);

        ringView = new LinearLayout(this);
        ringView.setOrientation(LinearLayout.VERTICAL);
        ringView.setGravity(Gravity.CENTER);
        ringView.setPadding(dp(28), dp(48), dp(28), dp(40));

        TextView icon = new TextView(this);
        icon.setText(timer ? "⏱" : "⏰");
        icon.setTextSize(58);
        icon.setGravity(Gravity.CENTER);
        ringView.addView(icon);

        clock = new TextView(this);
        clock.setTextColor(Color.WHITE);
        clock.setTextSize(76);
        clock.setTypeface(Typeface.create("sans-serif-light", Typeface.NORMAL));
        clock.setGravity(Gravity.CENTER);
        ringView.addView(clock);

        dateTv = new TextView(this);
        dateTv.setTextColor(0xB3FFFFFF);
        dateTv.setTextSize(15);
        dateTv.setGravity(Gravity.CENTER);
        ringView.addView(dateTv);

        TextView t = new TextView(this);
        t.setText(label == null || label.length() == 0 ? (timer ? "Timer" : "Alarm") : label);
        t.setTextColor(Color.WHITE);
        t.setTextSize(25);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setGravity(Gravity.CENTER);
        t.setPadding(0, dp(26), 0, dp(6));
        ringView.addView(t);

        TextView m = new TextView(this);
        m.setText(timer ? "Time's up!" : (tasks.length() > 0 ? "Solve a quick task to switch this off" : "Time to wake up and start studying 📚"));
        m.setTextColor(0xCCFFFFFF);
        m.setTextSize(16);
        m.setGravity(Gravity.CENTER);
        m.setPadding(0, 0, 0, dp(36));
        ringView.addView(m);

        if (timer) ringView.addView(button("+1 min", 0x33FFFFFF, Color.WHITE, new View.OnClickListener() {
            @Override public void onClick(View v) { send(RingService.ACTION_ADD_MIN); }
        }));
        if (canSnooze) ringView.addView(button("Snooze " + snoozeMin + " min", 0x33FFFFFF, Color.WHITE, new View.OnClickListener() {
            @Override public void onClick(View v) { send(RingService.ACTION_SNOOZE); }
        }));
        ringView.addView(button(timer ? "Stop" : "Dismiss", Color.WHITE, 0xFF3730A3, new View.OnClickListener() {
            @Override public void onClick(View v) {
                if (!timer && tasks.length() > 0) { taskIndex = 0; showTask(); } else send(RingService.ACTION_STOP);
            }
        }));
        stage.addView(ringView, new FrameLayout.LayoutParams(-1, -1));
        setContentView(stage);

        IntentFilter f = new IntentFilter(ACTION_CLOSE);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(closer, f, Context.RECEIVER_NOT_EXPORTED); else registerReceiver(closer, f);
        handler.post(tick);
    }

    private void send(String action) {
        Intent i = new Intent(this, RingService.class);
        i.setAction(action);
        try { startService(i); } catch (Exception ignored) { }
        finish();
    }

    private Button button(String text, int bg, int fg, View.OnClickListener l) {
        Button bt = new Button(this);
        bt.setText(text);
        bt.setAllCaps(false);
        bt.setTextSize(18);
        bt.setTypeface(Typeface.DEFAULT_BOLD);
        bt.setTextColor(fg);
        GradientDrawable d = new GradientDrawable();
        d.setColor(bg);
        d.setCornerRadius(dp(30));
        bt.setBackground(d);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(60));
        lp.setMargins(0, dp(12), 0, 0);
        bt.setLayoutParams(lp);
        bt.setOnClickListener(l);
        return bt;
    }

    private Button pad(String text, int size, View.OnClickListener l) {
        Button bt = new Button(this);
        bt.setText(text);
        bt.setAllCaps(false);
        bt.setTextSize(size);
        bt.setTextColor(Color.WHITE);
        GradientDrawable d = new GradientDrawable();
        d.setColor(0x26FFFFFF);
        d.setCornerRadius(dp(18));
        bt.setBackground(d);
        bt.setOnClickListener(l);
        return bt;
    }

    private void taskDone() {
        taskIndex++;
        if (taskIndex >= tasks.length()) send(RingService.ACTION_STOP); else showTask();
    }

    private void showTask() {
        ringView.setVisibility(View.GONE);
        JSONObject spec = tasks.optJSONObject(taskIndex);
        String type = spec == null ? "math" : spec.optString("t", "math");
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER_HORIZONTAL);
        box.setPadding(dp(24), dp(56), dp(24), dp(24));
        box.setTag("task");
        for (int i = stage.getChildCount() - 1; i >= 0; i--) if ("task".equals(stage.getChildAt(i).getTag())) stage.removeViewAt(i);

        TextView head = new TextView(this);
        head.setText("Task " + (taskIndex + 1) + " of " + tasks.length());
        head.setTextColor(0xB3FFFFFF);
        head.setTextSize(14);
        head.setGravity(Gravity.CENTER);
        box.addView(head);

        if ("retype".equals(type)) buildRetype(box, spec);
        else if ("seq".equals(type)) buildSeq(box, spec);
        else buildMath(box, spec);
        stage.addView(box, new FrameLayout.LayoutParams(-1, -1));
    }

    private void buildMath(LinearLayout box, JSONObject spec) {
        int d = spec == null ? 1 : spec.optInt("d", 1);
        final int ans;
        String q;
        int a, b2, c;
        if (d <= 1) { a = 10 + rnd.nextInt(80); b2 = 10 + rnd.nextInt(80); ans = a + b2; q = a + " + " + b2; }
        else if (d == 2) { a = 3 + rnd.nextInt(10); b2 = 3 + rnd.nextInt(7); c = 5 + rnd.nextInt(40); ans = a * b2 + c; q = a + " × " + b2 + " + " + c; }
        else { a = 12 + rnd.nextInt(18); b2 = 3 + rnd.nextInt(7); c = 10 + rnd.nextInt(60); ans = a * b2 - c; q = a + " × " + b2 + " − " + c; }

        TextView qt = new TextView(this);
        qt.setText(q + " = ?");
        qt.setTextColor(Color.WHITE);
        qt.setTextSize(36);
        qt.setTypeface(Typeface.DEFAULT_BOLD);
        qt.setGravity(Gravity.CENTER);
        qt.setPadding(0, dp(30), 0, dp(10));
        box.addView(qt);

        final TextView typed = new TextView(this);
        typed.setTextColor(0xFFC7D2FE);
        typed.setTextSize(34);
        typed.setGravity(Gravity.CENTER);
        typed.setText("–");
        box.addView(typed);

        final StringBuilder sb = new StringBuilder();
        GridLayout g = new GridLayout(this);
        g.setColumnCount(3);
        String[] keys = {"1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"};
        for (final String k : keys) {
            Button bt = pad(k, 24, new View.OnClickListener() {
                @Override public void onClick(View v) {
                    if (k.equals("⌫")) { if (sb.length() > 0) sb.deleteCharAt(sb.length() - 1); }
                    else if (k.equals("✓")) {
                        try { if (Integer.parseInt(sb.toString()) == ans) { taskDone(); return; } } catch (Exception ignored) { }
                        sb.setLength(0);
                        typed.setText("Try again");
                        return;
                    } else if (sb.length() < 6) sb.append(k);
                    typed.setText(sb.length() == 0 ? "–" : sb.toString());
                }
            });
            GridLayout.LayoutParams lp = new GridLayout.LayoutParams();
            lp.width = dp(92); lp.height = dp(64); lp.setMargins(dp(6), dp(6), dp(6), dp(6));
            g.addView(bt, lp);
        }
        LinearLayout.LayoutParams glp = new LinearLayout.LayoutParams(-2, -2);
        glp.topMargin = dp(18);
        box.addView(g, glp);
    }

    private void buildRetype(LinearLayout box, JSONObject spec) {
        int len = spec == null ? 8 : Math.max(4, Math.min(16, spec.optInt("len", 8)));
        String chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < len; i++) sb.append(chars.charAt(rnd.nextInt(chars.length())));
        final String target = sb.toString();

        TextView tip = new TextView(this);
        tip.setText("Type this text exactly");
        tip.setTextColor(0xCCFFFFFF);
        tip.setTextSize(16);
        tip.setGravity(Gravity.CENTER);
        tip.setPadding(0, dp(30), 0, dp(10));
        box.addView(tip);

        TextView tv = new TextView(this);
        tv.setText(target);
        tv.setTextColor(Color.WHITE);
        tv.setTextSize(34);
        tv.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        tv.setGravity(Gravity.CENTER);
        tv.setPadding(0, 0, 0, dp(20));
        box.addView(tv);

        final EditText et = new EditText(this);
        et.setTextColor(Color.WHITE);
        et.setTextSize(24);
        et.setGravity(Gravity.CENTER);
        et.setSingleLine(true);
        et.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
        GradientDrawable d = new GradientDrawable();
        d.setColor(0x26FFFFFF);
        d.setCornerRadius(dp(18));
        et.setBackground(d);
        box.addView(et, new LinearLayout.LayoutParams(-1, dp(60)));
        box.addView(button("Done", Color.WHITE, 0xFF3730A3, new View.OnClickListener() {
            @Override public void onClick(View v) {
                if (et.getText().toString().equals(target)) taskDone(); else { et.setText(""); et.setHint("Try again"); et.setHintTextColor(0x99FFFFFF); }
            }
        }));
    }

    private void buildSeq(LinearLayout box, JSONObject spec) {
        final int n = spec == null ? 5 : Math.max(3, Math.min(9, spec.optInt("n", 5)));
        TextView tip = new TextView(this);
        tip.setText("Tap the numbers in order, 1 → " + n);
        tip.setTextColor(0xCCFFFFFF);
        tip.setTextSize(16);
        tip.setGravity(Gravity.CENTER);
        tip.setPadding(0, dp(30), 0, dp(14));
        box.addView(tip);

        ArrayList<Integer> nums = new ArrayList<Integer>();
        for (int i = 1; i <= n; i++) nums.add(i);
        Collections.shuffle(nums, rnd);
        final int[] next = {1};
        final ArrayList<Button> btns = new ArrayList<Button>();
        GridLayout g = new GridLayout(this);
        g.setColumnCount(3);
        for (final int v : nums) {
            final Button bt = pad(String.valueOf(v), 28, null);
            bt.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View x) {
                    if (v == next[0]) {
                        bt.setEnabled(false); bt.setAlpha(0.35f); next[0]++;
                        if (next[0] > n) taskDone();
                    } else {
                        next[0] = 1;
                        for (Button o : btns) { o.setEnabled(true); o.setAlpha(1f); }
                    }
                }
            });
            btns.add(bt);
            GridLayout.LayoutParams lp = new GridLayout.LayoutParams();
            lp.width = dp(92); lp.height = dp(92); lp.setMargins(dp(6), dp(6), dp(6), dp(6));
            g.addView(bt, lp);
        }
        box.addView(g, new LinearLayout.LayoutParams(-2, -2));
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(tick);
        try { unregisterReceiver(closer); } catch (Exception ignored) { }
        super.onDestroy();
    }

    @Override public void onBackPressed() { /* must use the buttons */ }
}
