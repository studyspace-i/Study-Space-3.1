#!/usr/bin/env bash
# Safety net: takes the native alarm engine out again (the app then uses the standard notification alarms).
B=android/app/src/main
J=$B/java/in/mrharshit/studyspace
[ -f "$J/MainActivity.java.orig" ] && mv "$J/MainActivity.java.orig" "$J/MainActivity.java"
[ -f "$B/AndroidManifest.xml.orig" ] && mv "$B/AndroidManifest.xml.orig" "$B/AndroidManifest.xml"
rm -rf "$J/clock"
echo "native clock removed"
