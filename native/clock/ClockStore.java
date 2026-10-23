package in.mrharshit.studyspace.clock;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

/** Keeps alarms and timers on the phone (survives app restarts, reboots and cleared web data). */
public final class ClockStore {
    private static final String PREFS = "studyclock";
    private ClockStore() {}

    private static SharedPreferences sp(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    public static synchronized String getAlarmsJson(Context c) { return sp(c).getString("alarms", "[]"); }
    public static synchronized void setAlarmsJson(Context c, String json) { sp(c).edit().putString("alarms", json).apply(); }

    public static synchronized String getTimersJson(Context c) { return sp(c).getString("timers", "[]"); }
    public static synchronized void setTimersJson(Context c, String json) { sp(c).edit().putString("timers", json).apply(); }

    public static JSONArray alarms(Context c) {
        try { return new JSONArray(getAlarmsJson(c)); } catch (Exception e) { return new JSONArray(); }
    }

    public static JSONArray timers(Context c) {
        try { return new JSONArray(getTimersJson(c)); } catch (Exception e) { return new JSONArray(); }
    }

    private static String key(Calendar c) {
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    public static String scheduleOf(JSONObject a) {
        String s = a.optString("sched", "");
        if (s.length() > 0) return s;
        if (a.optBoolean("once", false)) return "once";
        JSONArray d = a.optJSONArray("days");
        return (d == null || d.length() == 0) ? "daily" : "weekly";
    }

    private static boolean dayOk(JSONObject a, String sched, Calendar c) {
        int dow = c.get(Calendar.DAY_OF_WEEK) - 1;
        String k = key(c);
        JSONArray days = a.optJSONArray("days");
        boolean daysSet = days != null && days.length() > 0;
        boolean inDays = false;
        if (daysSet) for (int i = 0; i < days.length(); i++) if (days.optInt(i, -1) == dow) inDays = true;
        switch (sched) {
            case "weekly": return !daysSet || inDays;
            case "dates": {
                JSONArray ds = a.optJSONArray("dates");
                if (ds == null) return false;
                for (int i = 0; i < ds.length(); i++) if (k.equals(ds.optString(i))) return true;
                return false;
            }
            case "range": {
                String f = a.optString("from", ""), t = a.optString("to", "");
                if (f.length() > 0 && k.compareTo(f) < 0) return false;
                if (t.length() > 0 && k.compareTo(t) > 0) return false;
                return !daysSet || inDays;
            }
            default: return true;   // once, daily
        }
    }

    /** Next time (ms) this alarm should ring, or -1. Handles once / daily / weekly / specific dates / date range, and "skip next". */
    public static long nextTrigger(JSONObject a, long now) {
        try {
            if (!a.optBoolean("on", true)) return -1;
            String[] p = a.optString("time", "06:00").split(":");
            int hh = Integer.parseInt(p[0]);
            int mm = Integer.parseInt(p[1]);
            String sched = scheduleOf(a);
            long min = Math.max(now + 1000, a.optLong("skipTo", 0) + 1000);
            int span = "daily".equals(sched) || "weekly".equals(sched) || "once".equals(sched) ? 9 : 800;
            for (int add = 0; add < span; add++) {
                Calendar c = Calendar.getInstance();
                c.setTimeInMillis(now);
                c.add(Calendar.DAY_OF_YEAR, add);
                c.set(Calendar.HOUR_OF_DAY, hh);
                c.set(Calendar.MINUTE, mm);
                c.set(Calendar.SECOND, 0);
                c.set(Calendar.MILLISECOND, 0);
                if (c.getTimeInMillis() >= min && dayOk(a, sched, c)) return c.getTimeInMillis();
            }
        } catch (Exception e) { /* ignore bad entry */ }
        return -1;
    }

    public static JSONObject findAlarm(Context c, int id) {
        JSONArray arr = alarms(c);
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o != null && o.optInt("id", -1) == id) return o;
        }
        return null;
    }

    public static JSONObject findTimer(Context c, int id) {
        JSONArray arr = timers(c);
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o != null && o.optInt("id", -1) == id) return o;
        }
        return null;
    }

    /** Write one changed alarm back into the stored list. */
    public static synchronized void updateAlarm(Context c, JSONObject changed) {
        try {
            JSONArray arr = alarms(c);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o != null && o.optInt("id", -1) == changed.optInt("id", -2)) { arr.put(i, changed); break; }
            }
            setAlarmsJson(c, arr.toString());
        } catch (Exception ignored) { }
    }

    public static synchronized void removeAlarm(Context c, int id) {
        try {
            JSONArray arr = alarms(c), out = new JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o != null && o.optInt("id", -1) != id) out.put(o);
            }
            setAlarmsJson(c, out.toString());
        } catch (Exception ignored) { }
    }

    public static synchronized void updateTimer(Context c, JSONObject changed) {
        try {
            JSONArray arr = timers(c);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o != null && o.optInt("id", -1) == changed.optInt("id", -2)) { arr.put(i, changed); break; }
            }
            setTimersJson(c, arr.toString());
        } catch (Exception ignored) { }
    }
}
