#!/usr/bin/env bash
# Adds the phone's own alarm engine (real alarms, lock-screen ring, timer in the notification panel).
set -e
B=android/app/src/main
J=$B/java/in/mrharshit/studyspace
mkdir -p "$J/clock"
cp native/clock/*.java "$J/clock/"
cp "$J/MainActivity.java" "$J/MainActivity.java.orig"
cp "$B/AndroidManifest.xml" "$B/AndroidManifest.xml.orig"
cat > "$J/MainActivity.java" <<'JAVA'
package in.mrharshit.studyspace;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import in.mrharshit.studyspace.clock.StudyClockPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StudyClockPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
JAVA
python3 - "$B/AndroidManifest.xml" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
perms='''    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
'''
comps='''        <activity android:name="in.mrharshit.studyspace.clock.RingActivity" android:exported="false" android:launchMode="singleInstance" android:windowSoftInputMode="adjustResize" android:taskAffinity="" android:excludeFromRecents="true" android:showWhenLocked="true" android:turnScreenOn="true" android:theme="@android:style/Theme.Material.NoActionBar" />
        <service android:name="in.mrharshit.studyspace.clock.RingService" android:exported="false" android:foregroundServiceType="mediaPlayback" />
        <receiver android:name="in.mrharshit.studyspace.clock.AlarmReceiver" android:exported="false" />
        <receiver android:name="in.mrharshit.studyspace.clock.BootReceiver" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="android.intent.action.TIME_SET" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
            </intent-filter>
        </receiver>
'''
s=s.replace("<application",perms+"\n    <application",1)
s=s.replace("</application>",comps+"    </application>",1)
open(p,"w").write(s)
PY
echo "native clock installed"
