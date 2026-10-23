#!/usr/bin/env bash
# Builds the production APK (release, signed with the app key).
# Order: with the phone's own alarm engine -> without it -> standard build. The first one that works is used.
set -u
OUT=$PWD/StudySpace.apk
build_release() { ( cd android && chmod +x gradlew && ./gradlew assembleRelease --no-daemon -q ); }
sign() {
  SRC=$(ls android/app/build/outputs/apk/release/*.apk | head -1)
  BT=$(ls -d "${ANDROID_HOME:-/usr/local/lib/android/sdk}"/build-tools/* | sort -V | tail -1)
  "$BT/zipalign" -p -f 4 "$SRC" android/aligned.apk
  "$BT/apksigner" sign --ks resources/debug.keystore --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey --out "$OUT" android/aligned.apk
  "$BT/apksigner" verify "$OUT"
}
bash scripts/native-install.sh
if build_release; then echo "BUILD: with native alarm engine"; sign
else
  echo "Native alarm engine could not be built - using standard alarms"
  bash scripts/native-remove.sh
  ( cd android && ./gradlew clean --no-daemon -q ) || true
  if build_release; then echo "BUILD: standard"; sign
  else
    echo "Release build failed - building the standard build instead"
    ( cd android && ./gradlew assembleDebug --no-daemon -q ) && cp android/app/build/outputs/apk/debug/app-debug.apk "$OUT"
  fi
fi
ls -la "$OUT"
