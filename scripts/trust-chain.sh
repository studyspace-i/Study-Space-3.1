#!/usr/bin/env bash
# Fixes "Trust anchor for certification path not found" on Android.
# Your host sends only the website certificate (issuer WR1 = Google Trust Services) and NOT the
# intermediate certificate. Browsers fetch it themselves, Android apps do not. So at build time we
# download the official Google intermediates (WR1..WR5 + the exact one your site uses), check each is
# genuinely signed by a trusted root, and bundle them inside the app as extra trusted CAs.
set -u
HOST="${1:-study.mrharshit.in}"
RES=android/app/src/main/res
RAW=$RES/raw; XML=$RES/xml
mkdir -p "$RAW" "$XML"
TMP=$(mktemp -d); N=0

try_cert() {   # $1=url  $2=resource-name
  local f="$TMP/$2.dl"
  curl -fsSL --max-time 30 "$1" -o "$f" 2>/dev/null || { echo "skip $2 (download failed)"; return; }
  if ! openssl x509 -in "$f" -outform PEM -out "$TMP/$2.pem" 2>/dev/null; then
    openssl x509 -inform DER -in "$f" -outform PEM -out "$TMP/$2.pem" 2>/dev/null || { echo "skip $2 (not a certificate)"; return; }
  fi
  # Safety: only accept certificates that chain to a root already trusted by the system.
  if openssl verify -CAfile /etc/ssl/certs/ca-certificates.crt "$TMP/$2.pem" >/dev/null 2>&1; then
    cp "$TMP/$2.pem" "$RAW/$2.pem"; N=$((N+1)); echo "added $2: $(openssl x509 -in "$TMP/$2.pem" -noout -subject)"
  else
    echo "skip $2 (does not chain to a trusted root)"
  fi
}

# 1) the exact intermediate your live server's certificate points to (AIA)
echo | openssl s_client -connect "$HOST:443" -servername "$HOST" 2>/dev/null | openssl x509 -outform PEM > "$TMP/leaf.pem" 2>/dev/null
AIA=$(openssl x509 -in "$TMP/leaf.pem" -noout -ext authorityInfoAccess 2>/dev/null | grep -i 'CA Issuers' | head -1 | sed 's/.*URI://')
echo "Leaf issuer: $(openssl x509 -in "$TMP/leaf.pem" -noout -issuer 2>/dev/null)  AIA: ${AIA:-none}"
[ -n "${AIA:-}" ] && try_cert "$AIA" "site_issuer"

# 2) all Google Trust Services RSA intermediates, so a future renewal (WR2, WR3...) keeps working
for i in 1 2 3 4 5; do
  try_cert "https://pki.goog/repo/certs/wr$i.pem" "gts_wr$i" || true
done

echo "Bundled $N intermediate certificate(s)."
if [ "$N" -gt 0 ]; then
  {
    echo '<?xml version="1.0" encoding="utf-8"?>'
    echo '<network-security-config><base-config cleartextTrafficPermitted="false"><trust-anchors>'
    echo '<certificates src="system"/>'
    for f in "$RAW"/*.pem; do n=$(basename "$f" .pem); echo "<certificates src=\"@raw/$n\"/>"; done
    echo '</trust-anchors></base-config></network-security-config>'
  } > "$XML/network_security_config.xml"
  sed -i 's#<application#<application android:networkSecurityConfig="@xml/network_security_config"#' android/app/src/main/AndroidManifest.xml
  echo "Network security config installed."
else
  echo "WARNING: no intermediate could be downloaded; app will rely on the server sending its full chain."
fi
