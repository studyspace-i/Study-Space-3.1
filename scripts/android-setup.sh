#!/usr/bin/env bash
# Runs after `cap add android`: permissions, stable signing key, icon, network trust.
set -e
M=android/app/src/main/AndroidManifest.xml
PERMS='    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.USE_BIOMETRIC" />
    <uses-permission android:name="android.permission.USE_FINGERPRINT" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-feature android:name="android.hardware.location" android:required="false" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.front" android:required="false" />
    <uses-feature android:name="android.hardware.fingerprint" android:required="false" />'
# insert the permission block right before <application
python3 - "$M" "$PERMS" <<'PY'
import sys,re
p,perms=sys.argv[1],sys.argv[2]
s=open(p).read()
s=s.replace("<application", perms+"\n\n    <application",1)
open(p,"w").write(s)
PY
# production hardening + packaging
python3 - "$M" <<'PY'
import sys,re
p=sys.argv[1]; s=open(p).read()
s=s.replace('android:allowBackup="true"','android:allowBackup="false"')
if 'android:fullBackupContent' not in s: s=s.replace('<application','<application android:fullBackupContent="false"',1)
s=re.sub(r'(<activity\b)', r'\1 android:screenOrientation="portrait"', s, count=1) if 'screenOrientation' not in s else s
open(p,'w').write(s)
PY
G=android/app/build.gradle
VC=$((210000 + ${GITHUB_RUN_NUMBER:-1}))
sed -i -E "s/versionCode [0-9]+/versionCode $VC/; s/versionName \"[^\"]*\"/versionName \"2.5.1\"/" "$G"
grep -n "versionCode\|versionName" "$G" || true
# alarm tones used by notification channels
mkdir -p android/app/src/main/res/raw && cp resources/sounds/*.wav android/app/src/main/res/raw/
# icon + colours
cp -r resources/res/* android/app/src/main/res/
# same signing key on every build => new APK installs over the old one (keeps passcode & login)
mkdir -p "$HOME/.android" && cp resources/debug.keystore "$HOME/.android/debug.keystore"
# Password manager (Google / Samsung): trust link between the app and the website
S=android/app/src/main/res/values/strings.xml
python3 - "$S" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
add='    <string name="asset_statements" translatable="false">[{\\"include\\": \\"https://study.mrharshit.in/.well-known/assetlinks.json\\"}]</string>\n'
if "asset_statements" not in s: s=s.replace("</resources>", add+"</resources>",1)
open(p,"w").write(s)
PY
# Firebase (push notifications): the client config file goes next to the app module
if [ -f resources/google-services.json ]; then
  cp resources/google-services.json android/app/google-services.json
  python3 - "$M" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
meta='''        <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="general" />
        <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_notify" />
'''
if "default_notification_channel_id" not in s:
    s=s.replace("</application>", meta+"    </application>",1)
open(p,"w").write(s)
PY
  echo "firebase config added"
fi
echo "android setup done"
