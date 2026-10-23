// Study Space — live location + address auto-fill.
//
// Two globals:
//   LocationKit    shared helpers: load Google Maps once, reverse/forward
//                  geocode (Google first, free OpenStreetMap as a backup)
//   LocationPicker <div>-mountable widget used on sign-up, create-center and
//                  Admin -> Settings:  "Use my current location" button,
//                  place search, draggable map pin, and the address fields
//                  (line / city / state / PIN) filled in automatically.
//
// The Google Maps key is NOT in this file. It lives in config/config.php
// (GOOGLE_MAPS_BROWSER_KEY) and is handed over by GET /api/config/public.
// Needs assets/main.js (for api()) loaded first.

(function () {
  "use strict";

  const STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
    "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
  ];
  const ALIAS = {
    orissa: "odisha", "nct of delhi": "delhi", "national capital territory of delhi": "delhi", "new delhi": "delhi",
    pondicherry: "puducherry", uttaranchal: "uttarakhand", "andaman and nicobar": "andaman and nicobar islands",
    "dadra and nagar haveli": "dadra and nagar haveli and daman and diu", "daman and diu": "dadra and nagar haveli and daman and diu",
  };
  const norm = (s) => String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  function matchState(name) {
    const n = norm(name);
    if (!n) return null;
    const a = ALIAS[n] || n;
    return STATES.find((s) => norm(s) === a) || null;
  }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isPlusCode = (s) => /^[A-Z0-9]{4,8}\+[A-Z0-9]{2,}/.test(String(s || "").trim());

  // ------------------------------------------------------------------
  //  Config + Google Maps loader (loaded once per page, on demand)
  // ------------------------------------------------------------------
  let cfgPromise = null;
  function getConfig() {
    if (!cfgPromise) {
      cfgPromise = api("/config/public")
        .then((r) => r.data)
        .catch(() => ({ googleMapsKey: "", googleMapId: "DEMO_MAP_ID" }));
    }
    return cfgPromise;
  }

  let gPromise = null;
  let googleBroken = false; // set if Google rejects the key / referrer / billing
  function loadGoogle() {
    if (gPromise) return gPromise;
    gPromise = (async () => {
      if (window.google && google.maps && google.maps.importLibrary) return true;
      const cfg = await getConfig();
      if (!cfg.googleMapsKey) return false;
      return new Promise((resolve) => {
        let settled = false;
        const done = (v) => { if (!settled) { settled = true; resolve(v); } };
        // Google calls this if the key is wrong / restricted / billing is off.
        window.gm_authFailure = () => {
          googleBroken = true;
          console.warn("[Study Space] Google Maps rejected the API key. Check: key pasted in config/config.php, HTTP-referrer restriction includes this site, billing enabled, Maps JavaScript API enabled.");
          document.dispatchEvent(new CustomEvent("gmaps-auth-failure"));
          done(false);
        };
        window.__ssGmapsReady = () => done(true);
        const s = document.createElement("script");
        s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(cfg.googleMapsKey) +
          "&loading=async&callback=__ssGmapsReady&v=weekly&language=en&region=IN";
        s.async = true;
        s.onerror = () => done(false);
        document.head.appendChild(s);
        setTimeout(() => done(false), 15000);
      });
    })();
    return gPromise;
  }
  const googleOk = async () => (await loadGoogle()) && !googleBroken;

  // ------------------------------------------------------------------
  //  Normalising results from Google (Geocoder + Places) and OSM
  // ------------------------------------------------------------------
  function pickCity(get) {
    return get("locality") || get("postal_town") || get("administrative_area_level_3") || get("administrative_area_level_2") || "";
  }

  // comps: [{ long, types }]
  function fromGoogle(comps, formatted, extraPin) {
    const get = (...types) => {
      for (const t of types) {
        const c = comps.find((x) => x.types.includes(t));
        if (c && c.long) return c.long;
      }
      return "";
    };
    const city = pickCity(get);
    const stateRaw = get("administrative_area_level_1");
    const state = matchState(stateRaw) || stateRaw;
    const pincode = get("postal_code") || extraPin || "";

    let parts = [
      get("premise"), get("subpremise"), get("street_number"), get("route"),
      get("neighborhood"), get("sublocality_level_3"), get("sublocality_level_2"), get("sublocality_level_1"), get("sublocality"),
    ].filter((p) => p && !isPlusCode(p) && p !== city);
    parts = parts.filter((p, i) => parts.indexOf(p) === i);

    let line = parts.join(", ");
    if (!line && formatted) {
      line = formatted.split(",").map((p) => p.trim())
        .filter((p) => p && !isPlusCode(p) && p !== city && p !== stateRaw && p !== pincode && !/^india$/i.test(p) && !/^\d{6}$/.test(p))
        .slice(0, 2).join(", ");
    }
    return { line, city, state, pincode };
  }

  function fromOsm(a) {
    a = a || {};
    const line = [a.house_number, a.road, a.neighbourhood || a.suburb || a.hamlet || a.quarter].filter(Boolean).join(", ");
    const city = a.city || a.town || a.village || a.municipality || a.county || a.state_district || "";
    const state = matchState(a.state) || a.state || "";
    return { line, city, state, pincode: (a.postcode || "").replace(/\s+/g, "") };
  }

  async function reverse(lat, lng) {
    if (await googleOk()) {
      try {
        const { Geocoder } = await google.maps.importLibrary("geocoding");
        const { results } = await new Geocoder().geocode({ location: { lat, lng } });
        if (results && results.length) {
          const toComps = (r) => r.address_components.map((c) => ({ long: c.long_name, types: c.types }));
          // A rural pin often has no PIN in the top result — borrow one from the others.
          let extraPin = "";
          for (const r of results) {
            const pc = r.address_components.find((c) => c.types.includes("postal_code"));
            if (pc) { extraPin = pc.long_name; break; }
          }
          const out = fromGoogle(toComps(results[0]), results[0].formatted_address, extraPin);
          out.placeId = results[0].place_id || null;
          return out;
        }
      } catch (e) {
        console.warn("[Study Space] Google reverse-geocode failed (is the Geocoding API enabled?):", e && e.message);
      }
    }
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`, { headers: { Accept: "application/json" } });
      const j = await r.json();
      if (j && j.address) return Object.assign(fromOsm(j.address), { placeId: null });
    } catch (e) { /* offline or blocked */ }
    return null;
  }

  // Free-text search ("Station Road, Bhabua") -> { lat, lng, line, city, state, pincode, placeId }
  async function geocodeText(q) {
    if (await googleOk()) {
      try {
        const { Geocoder } = await google.maps.importLibrary("geocoding");
        const { results } = await new Geocoder().geocode({ address: q, componentRestrictions: { country: "IN" } });
        if (results && results.length) {
          const r = results[0];
          const out = fromGoogle(r.address_components.map((c) => ({ long: c.long_name, types: c.types })), r.formatted_address);
          out.lat = r.geometry.location.lat();
          out.lng = r.geometry.location.lng();
          out.placeId = r.place_id || null;
          return out;
        }
      } catch (e) {
        console.warn("[Study Space] Google geocode failed (is the Geocoding API enabled?):", e && e.message);
      }
    }
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
      const j = await r.json();
      if (j && j[0]) return Object.assign(fromOsm(j[0].address), { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon), placeId: null });
    } catch (e) { /* offline or blocked */ }
    return null;
  }

  const latOf = (p) => (typeof p.lat === "function" ? p.lat() : p.lat);
  const lngOf = (p) => (typeof p.lng === "function" ? p.lng() : p.lng);

  window.LocationKit = { STATES, matchState, esc, getConfig, loadGoogle, googleOk, reverse, geocodeText, latOf, lngOf, isBroken: () => googleBroken };

  // ------------------------------------------------------------------
  //  The picker widget
  // ------------------------------------------------------------------
  const GPS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7.5"/></svg>';

  const CENTER_LINE_PLACEHOLDER = "Building / floor, street, area, landmark";
  const STUDENT_LINE_PLACEHOLDER = "House no., street, area, landmark";

  function mount(root, options) {
    const opts = Object.assign({ mode: "student", values: {}, tall: false, onChange: function () {} }, options || {});
    const isCenter = opts.mode === "center";
    const accent = (getComputedStyle(document.body).getPropertyValue("--a1") || "").trim() || "#2563eb";

    root.classList.add("loc");
    root.innerHTML = `
      <button type="button" class="loc-gps" data-gps>
        <span class="loc-gps-ico">${GPS_SVG}</span>
        <span><span data-gps-title>Use my current location</span>
          <small>${isCenter ? "Standing at your center? Tap — we drop the pin and fill the address for you." : "We'll fill in your address, city, state &amp; PIN automatically."}</small></span>
      </button>
      <div class="loc-status" data-status hidden></div>

      <div class="loc-or"><span>or search ${isCenter ? "your center's place" : "your area"}</span></div>
      <div class="loc-search-wrap" data-search></div>

      <div class="loc-map ${opts.tall ? "tall" : ""}" data-map>
        <div class="ph" data-ph><div><span class="pin">📍</span><b>Loading map…</b>Just a moment.</div></div>
      </div>
      <p class="loc-hint" data-maphint>💡 Drag the pin — or tap anywhere on the map — to fine-tune the exact spot. The address below updates by itself.</p>

      <div class="loc-grid">
        <div class="lf full" data-wrap="addressLine">
          <label>${isCenter ? "Center address" : "Address"} <i>(house / building, street, area)</i></label>
          <textarea data-f="addressLine" rows="2" maxlength="255" placeholder="${isCenter ? CENTER_LINE_PLACEHOLDER : STUDENT_LINE_PLACEHOLDER}"></textarea>
        </div>
        <div class="lf" data-wrap="city"><label>City / Town</label><input data-f="city" maxlength="100" placeholder="e.g. Bhabua" autocomplete="address-level2" /></div>
        <div class="lf" data-wrap="state"><label>State</label>
          <select data-f="state" autocomplete="address-level1"><option value="">Select state</option>${STATES.map((s) => `<option>${esc(s)}</option>`).join("")}</select></div>
        <div class="lf" data-wrap="pincode"><label>PIN code</label><input data-f="pincode" inputmode="numeric" maxlength="6" placeholder="6-digit PIN" autocomplete="postal-code" /></div>
        <div class="lf" data-wrap="coords"><label>Map pin</label><div class="loc-coords" data-coords>📍 Not pinned yet</div></div>
      </div>`;

    const q = (sel) => root.querySelector(sel);
    const gpsBtn = q("[data-gps]"), gpsTitle = q("[data-gps-title]"), statusEl = q("[data-status]");
    const searchWrap = q("[data-search]"), mapEl = q("[data-map]"), phEl = q("[data-ph]"), coordsEl = q("[data-coords]");
    const F = {};
    root.querySelectorAll("[data-f]").forEach((el) => (F[el.dataset.f] = el));

    const state = { lat: null, lng: null, placeId: null };
    let map = null, marker = null, accCircle = null, libs = null, reverseToken = 0;

    // ---------- helpers ----------
    function status(msg, kind) {
      if (!msg) { statusEl.hidden = true; return; }
      statusEl.hidden = false;
      statusEl.className = "loc-status " + (kind || "info");
      statusEl.innerHTML = (kind === "info" ? '<span class="sp"></span>' : "") + `<span>${msg}</span>`;
    }
    const emit = () => opts.onChange(getValue());

    function setField(name, value, flash) {
      const el = F[name];
      if (!el) return;
      if (name === "state" && value && ![...el.options].some((o) => o.value === value)) {
        el.add(new Option(value, value)); // a state name we don't list — keep it rather than lose it
      }
      el.value = value || "";
      const w = root.querySelector(`[data-wrap="${name}"]`);
      if (w) w.classList.remove("bad");
      if (flash && value && w) { w.classList.remove("flash"); void w.offsetWidth; w.classList.add("flash"); }
    }

    function updateCoordsUI() {
      if (state.lat == null) {
        coordsEl.classList.remove("on");
        coordsEl.textContent = "📍 Not pinned yet";
      } else {
        coordsEl.classList.add("on");
        coordsEl.textContent = `✅ Pinned · ${state.lat.toFixed(5)}, ${state.lng.toFixed(5)}`;
      }
    }

    function applyAddress(r) {
      if (!r) return;
      if (r.line) setField("addressLine", r.line, true);
      setField("city", r.city, true);
      setField("state", r.state, true);
      setField("pincode", r.pincode, true);
      if (r.placeId !== undefined) state.placeId = r.placeId || null;
    }

    function showPlaceholder(html) {
      phEl.style.display = "grid";
      phEl.innerHTML = `<div>${html}</div>`;
    }

    // ---------- pin + map ----------
    async function setPin(lat, lng, o) {
      o = o || {};
      state.lat = lat; state.lng = lng;
      updateCoordsUI();

      if (map && libs) {
        const pos = { lat, lng };
        if (marker) marker.position = pos;
        else {
          const { AdvancedMarkerElement, PinElement } = libs.marker;
          const pin = new PinElement({ background: accent, borderColor: "#ffffff", glyphColor: "#ffffff", scale: 1.25 });
          marker = new AdvancedMarkerElement({ map, position: pos, content: pin.element, gmpDraggable: true, title: "Drag to adjust" });
          marker.addListener("dragend", () => {
            const p = marker.position;
            setPin(latOf(p), lngOf(p), { reverse: true, pan: false });
          });
        }
        if (o.pan !== false) { map.panTo(pos); if ((map.getZoom() || 0) < 16) map.setZoom(17); }
      }

      if (o.reverse) {
        const my = ++reverseToken;
        status("Finding the address for this spot…", "info");
        const r = await reverse(lat, lng);
        if (my !== reverseToken) return; // a newer pin replaced this one
        if (r) {
          applyAddress(r);
          status("Address filled in from your pin. Edit any box below if something looks off.", "ok");
        } else {
          status("Pin saved, but we couldn't look up the address automatically — please type it below.", "warn");
        }
      }
      emit();
    }

    async function initMap() {
      const ok = await googleOk();
      if (!ok) {
        const cfg = await getConfig();
        showPlaceholder(cfg.googleMapsKey
          ? "<span class='pin'>🗺️</span><b>Map couldn't load</b>Google Maps didn't accept the key yet (check billing / referrer restrictions). Your live location &amp; address boxes still work fine."
          : "<span class='pin'>🗺️</span><b>Map preview is off</b>No Google Maps key is set yet. Your live location &amp; address boxes still work fine.");
        q("[data-maphint]").hidden = true;
        buildFallbackSearch();
        return;
      }
      try {
        const cfg = await getConfig();
        const [maps, marker_, places] = await Promise.all([
          google.maps.importLibrary("maps"), google.maps.importLibrary("marker"), google.maps.importLibrary("places"),
        ]);
        libs = { maps, marker: marker_, places };
        const start = state.lat != null ? { lat: state.lat, lng: state.lng } : { lat: 22.9734, lng: 78.6569 };
        map = new maps.Map(mapEl, {
          center: start, zoom: state.lat != null ? 17 : 5, mapId: cfg.googleMapId || "DEMO_MAP_ID",
          disableDefaultUI: true, zoomControl: true, fullscreenControl: true, streetViewControl: false, mapTypeControl: true,
          gestureHandling: "cooperative", clickableIcons: false,
        });
        map.addListener("click", (e) => setPin(e.latLng.lat(), e.latLng.lng(), { reverse: true }));
        phEl.style.display = "none";
        if (state.lat != null) setPin(state.lat, state.lng, { reverse: false, pan: false });
        buildGoogleSearch();
      } catch (e) {
        console.warn("[Study Space] map init failed:", e);
        showPlaceholder("<span class='pin'>🗺️</span><b>Map couldn't load</b>Your live location &amp; address boxes still work fine.");
        buildFallbackSearch();
      }
    }

    // ---------- search box ----------
    function buildGoogleSearch() {
      try {
        const { PlaceAutocompleteElement } = libs.places;
        const ac = new PlaceAutocompleteElement({});
        try { ac.includedRegionCodes = ["in"]; } catch (e) { /* older versions */ }
        try { ac.placeholder = isCenter ? "Search your center or area…" : "Search your area, street or landmark…"; } catch (e) { /* not supported everywhere */ }
        const holder = document.createElement("div");
        holder.className = "loc-ac";
        holder.appendChild(ac);
        searchWrap.innerHTML = "";
        searchWrap.appendChild(holder);

        const onPick = async (ev) => {
          try {
            status("Getting that place…", "info");
            let place = ev.place;
            if (ev.placePrediction) place = ev.placePrediction.toPlace();
            await place.fetchFields({ fields: ["id", "formattedAddress", "location", "addressComponents"] });
            const comps = (place.addressComponents || []).map((c) => ({ long: c.longText, types: c.types }));
            const r = fromGoogle(comps, place.formattedAddress || "");
            r.placeId = place.id || null;
            applyAddress(r);
            await setPin(latOf(place.location), lngOf(place.location), { reverse: !r.city && !r.state });
            status("Found it! Check the address below and drag the pin if needed.", "ok");
          } catch (e) {
            console.warn("[Study Space] place select failed:", e);
            status("Couldn't load that place — try again, or tap the map to drop a pin.", "warn");
          }
        };
        ac.addEventListener("gmp-select", onPick);
        ac.addEventListener("gmp-placeselect", onPick); // older Maps versions
      } catch (e) {
        console.warn("[Study Space] PlaceAutocompleteElement unavailable, using simple search:", e);
        buildFallbackSearch();
      }
    }

    function buildFallbackSearch() {
      searchWrap.innerHTML = `<div class="loc-search"><input type="text" data-q placeholder="${isCenter ? "e.g. Station Road, Bhabua" : "e.g. your area, city or landmark"}" /><button type="button" data-go>Search</button></div>`;
      const input = searchWrap.querySelector("[data-q]"), go = searchWrap.querySelector("[data-go]");
      const run = async () => {
        const text = input.value.trim();
        if (text.length < 3) { status("Type at least 3 letters to search.", "warn"); return; }
        go.disabled = true; status("Searching…", "info");
        const r = await geocodeText(text);
        go.disabled = false;
        if (!r) { status("Couldn't find that place. Try a bigger area name, or use your current location.", "warn"); return; }
        applyAddress(r);
        await setPin(r.lat, r.lng, { reverse: false });
        status("Found it! Check the address below.", "ok");
      };
      go.addEventListener("click", run);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); run(); } });
    }

    // ---------- live location (GPS) ----------
    // watchPosition (not a single read) so the pin visibly "locks on" as the
    // phone's GPS gets more accurate, then stops after a few seconds.
    function locate() {
      if (!navigator.geolocation) { status("This browser can't share its location. Search for your place instead.", "err"); return; }
      if (!window.isSecureContext) { status("Location only works on a secure (https) page.", "err"); return; }

      gpsBtn.disabled = true; gpsBtn.classList.add("busy");
      gpsTitle.textContent = "Getting your live location…";
      status("Please tap <b>Allow</b> when your browser asks for location access.", "info");

      let best = null, finished = false, watchId = null, timer = null;

      const stop = () => {
        finished = true;
        if (watchId != null) navigator.geolocation.clearWatch(watchId);
        clearTimeout(timer);
        gpsBtn.disabled = false; gpsBtn.classList.remove("busy");
        gpsTitle.textContent = "Update from my current location";
        if (accCircle) { accCircle.setMap(null); accCircle = null; }
      };

      const finish = async () => {
        if (finished) return;
        stop();
        if (!best) { status("Couldn't get a location fix. Move near a window or search for your place instead.", "warn"); return; }
        await setPin(best.lat, best.lng, { reverse: true, pan: true });
        const m = Math.round(best.acc);
        if (best.acc > 500) {
          status(`Got your location, but it's rough (about ${m} m off). Please drag the pin to your exact spot.`, "warn");
        } else {
          status(`Location locked in (accurate to about ${m} m). Address filled — drag the pin if it's slightly off.`, "ok");
        }
      };

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (finished) return;
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy || 9999 };
          if (!best || c.acc < best.acc) {
            best = c;
            setPin(c.lat, c.lng, { reverse: false, pan: true }); // live-move the pin
            status(`Locking on… accuracy ~${Math.round(c.acc)} m`, "info");
            if (map && libs && window.google) {
              try {
                if (!accCircle) accCircle = new google.maps.Circle({ map, strokeColor: accent, strokeOpacity: .5, strokeWeight: 1, fillColor: accent, fillOpacity: .12, clickable: false });
                accCircle.setCenter({ lat: c.lat, lng: c.lng });
                accCircle.setRadius(Math.min(c.acc, 2000));
              } catch (e) { /* purely cosmetic */ }
            }
          }
          if (c.acc <= 30) finish();
        },
        (err) => {
          if (finished) return;
          if (best) { finish(); return; }
          stop();
          const msg = {
            1: "Location access is blocked. Tap the 🔒 icon next to the web address, allow Location, then try again — or search for your place above.",
            2: "Your device couldn't work out its location. Check that GPS / location services are on, or search for your place above.",
            3: "Getting your location took too long. Try again near a window, or search for your place above.",
          }[err.code] || "Couldn't get your location. Please search for your place above.";
          status(msg, "err");
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
      timer = setTimeout(finish, 9000); // stop refining after ~9 s
    }

    gpsBtn.addEventListener("click", locate);

    // ---------- fields ----------
    F.pincode.addEventListener("input", () => { F.pincode.value = F.pincode.value.replace(/\D/g, "").slice(0, 6); });
    root.querySelectorAll("[data-f]").forEach((el) => {
      el.addEventListener("input", () => { root.querySelector(`[data-wrap="${el.dataset.f}"]`).classList.remove("bad"); emit(); });
      el.addEventListener("change", emit);
    });
    document.addEventListener("gmaps-auth-failure", () => {
      showPlaceholder("<span class='pin'>🗺️</span><b>Map couldn't load</b>Google Maps didn't accept the key yet (check billing / referrer restrictions). Your live location &amp; address boxes still work fine.");
      q("[data-maphint]").hidden = true;
      buildFallbackSearch();
    });

    // ---------- public API ----------
    function getValue() {
      return {
        addressLine: F.addressLine.value.trim(),
        city: F.city.value.trim(),
        state: F.state.value.trim(),
        pincode: F.pincode.value.trim(),
        latitude: state.lat,
        longitude: state.lng,
        placeId: state.placeId,
        hasPin: state.lat != null,
      };
    }

    // Returns an error message (and highlights the field) or "" when fine.
    function validate() {
      const v = getValue();
      const problems = [
        ["addressLine", v.addressLine.length < 3, "Enter your address (house / street / area)"],
        ["city", v.city.length < 2, "Enter your city or town"],
        ["state", !v.state, "Select your state"],
        ["pincode", !/^\d{6}$/.test(v.pincode), "Enter a valid 6-digit PIN code"],
      ];
      root.querySelectorAll(".lf.bad").forEach((w) => w.classList.remove("bad"));
      for (const [name, bad, msg] of problems) {
        if (bad) {
          root.querySelector(`[data-wrap="${name}"]`).classList.add("bad");
          F[name].focus();
          return msg;
        }
      }
      return "";
    }

    function setValue(v) {
      v = v || {};
      setField("addressLine", v.addressLine || "");
      setField("city", v.city || "");
      setField("state", v.state || "");
      setField("pincode", v.pincode || "");
      state.placeId = v.placeId || null;
      if (v.latitude != null && v.longitude != null) {
        state.lat = Number(v.latitude); state.lng = Number(v.longitude);
        updateCoordsUI();
        if (map) setPin(state.lat, state.lng, { reverse: false, pan: true });
      }
    }

    setValue(opts.values);
    initMap();

    return { getValue, validate, setValue, locate };
  }

  window.LocationPicker = { mount };
})();
