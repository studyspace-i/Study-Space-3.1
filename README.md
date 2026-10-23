# Study Space — Android app v2.3

1. Server (InfinityFree): upload everything inside `2_INFINITYFREE_upload.zip` into `htdocs/` (keep the folder layout; `.htaccess` and `.well-known` are hidden folders/files).
2. GitHub: upload everything from this folder to a new repo (keep the hidden `.github` folder).
3. Actions tab -> green tick -> Releases -> download StudySpace.apk.

Website address: `app-shell/config.js`. The same signing key is used on every build, so a new APK installs over the old one.
The build first tries to include the phone's own alarm engine (`native/clock`); if that cannot be built it automatically builds the standard version.

## v2.2 notes
- Firebase: `resources/google-services.json` is copied into the Android project at build time (push alerts).
- Server needs `config/firebase-service-account.json` (Firebase Console → Project settings → Service accounts → Generate new private key) for alerts while the app is closed.
- Passcode: ON by default for admin/staff, OFF by default for students; both can switch it in Settings.


## v2.3 notes
- Developer messages: server `AppMessageController` + owner-portal "App message"; app `Core.dev`, `inbox.html`, shared details popup.
- Clock rebuilt (`clock.html`, `alarms.js`): Alarm / Timer / Stopwatch / Focus / Shift / Settings (with search). Time picker: dial, keyboard, spinner. Timer keypad. Fully offline, no pull-to-refresh, hidden for centre admins.
- Native (`native/clock/*.java`): schedules (once/daily/weekly/dates/range/skip), multi-timers, rising volume, snooze limits, wake-up tasks (math/retype/sequence) on the lock-screen ring, timer/stopwatch notifications visible on the lock screen.
- Admission camera: camera list, flip, circular face guide, square crop (`child.js`).
- Inspired by the feature set of the open-source Chrono clock (GPL-3.0, Flutter). No Chrono code is copied.
