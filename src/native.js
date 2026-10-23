// Bundled native plugins -> exposed on window.Native for the plain-HTML pages.
import { Capacitor, CapacitorHttp, CapacitorCookies, registerPlugin } from "@capacitor/core";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Camera } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";
import { Browser } from "@capacitor/browser";
import { NativeSettings, AndroidSettings, IOSSettings } from "capacitor-native-settings";
import { SplashScreen } from "@capacitor/splash-screen";
import { PrivacyScreen } from "@capacitor-community/privacy-screen";
import { AppLauncher } from "@capacitor/app-launcher";
import { Share } from "@capacitor/share";
import { PushNotifications } from "@capacitor/push-notifications";
import { Network } from "@capacitor/network";
import { SavePassword } from "@capgo/capacitor-autofill-save-password";
import qrcode from "qrcode-generator";
import aesjs from "aes-js";

// InfinityFree "bot check": the host answers with a tiny page that runs AES in JavaScript to make a
// cookie called __test. Browsers do it automatically; the app's native network layer must do it itself.
function solveChallenge(html) {
  var m = html.match(/toNumbers\("([0-9a-f]+)"\)/gi);
  if (!m || m.length < 3) return null;
  var h = m.map(function (x) { return x.match(/"([0-9a-f]+)"/i)[1]; });
  var bytes = function (s) { var o = []; for (var i = 0; i < s.length; i += 2) o.push(parseInt(s.substr(i, 2), 16)); return o; };
  var plain = new aesjs.ModeOfOperation.cbc(bytes(h[0]), bytes(h[1])).decrypt(new Uint8Array(bytes(h[2])));
  return aesjs.utils.hex.fromBytes(plain).toLowerCase();
}

const StudyClock = registerPlugin("StudyClock");

// QR code drawn on the phone (no internet / gateway needed): returns an SVG data-URL
function qrSvg(text, px) {
  var q = qrcode(0, "M"); q.addData(String(text)); q.make();
  var n = q.getModuleCount(), cell = 8, size = (n + 8) * cell, d = "";
  for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += "M" + ((c + 4) * cell) + " " + ((r + 4) * cell) + "h" + cell + "v" + cell + "h-" + cell + "z";
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + " " + size + '" width="' + (px || 220) + '" height="' + (px || 220) + '"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#111827"/></svg>';
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

window.Native = {
  StudyClock, PushNotifications, Network, SavePassword, qrSvg,
  Capacitor, Http: CapacitorHttp, Cookies: CapacitorCookies, SecureStorage, BiometricAuth, App,
  StatusBar, Style, LocalNotifications, Camera, Geolocation, Browser,
  Settings: NativeSettings, AndroidSettings, IOSSettings, SplashScreen, PrivacyScreen, AppLauncher, Share, solveChallenge,
};
