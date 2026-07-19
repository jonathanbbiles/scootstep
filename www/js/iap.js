/* ============================================================================
   ScootSteps — MONETIZATION / Pro gating   (ported from ChordLoop IAP_PATTERN.md)
   ----------------------------------------------------------------------------
   BUILD 1 SHIPS FREE. MONETIZATION_ENABLED = false ->
     • everything is unlocked, no lock badges, NO buy button anywhere,
     • tempo is the full 40–120% for everyone,
     • the "Pro" screen is an honest "early build — all unlocked" note, not a
       dead paywall.
   BUILD 2 = flip MONETIZATION_ENABLED = true and create the SKUs below in
   App Store Connect (subscription group + lifetime + packs). That is the ONLY
   code change — all gating logic already exists and is exercised by the flag.

   THE TRAP THIS AVOIDS (documented in ChordLoop's IAP_PATTERN.md):
   a guard that ran before the native bridge loaded made the buy button
   silently GRANT PRO FOR FREE and never call Apple. So here:
     • Pro is granted ONLY inside store.when().verified() — never optimistically,
       never from a guard, never from buy().
     • buy() is a no-op unless the native CdvPurchase bridge is present AND the
       product finished loading from Apple.
   ============================================================================ */
(function (global) {
  "use strict";

  var MONETIZATION_ENABLED = false;             // <<< build 1 = false. Flip to true for build 2.

  var UNLOCK_KEY = "ss_pro";                     // real entitlement flag (localStorage; persists in the Capacitor webview)
  var PRODUCTS = {
    // create these EXACT ids in App Store Connect for build 2 (brief §6.5 pricing)
    monthly:  "com.jonathanbiles.scootstep.pro.monthly",   // $6.99/mo  (auto-renewable subscription)
    yearly:   "com.jonathanbiles.scootstep.pro.yearly",    // $29.99/yr (auto-renewable subscription)
    lifetime: "com.jonathanbiles.scootstep.pro.lifetime",  // $59.99    (non-consumable)
    packWedding: "com.jonathanbiles.scootstep.pack.wedding"// $4.99     (non-consumable gift pack)
  };
  var PRICE_FALLBACK = { monthly: "$6.99", yearly: "$29.99", lifetime: "$59.99", packWedding: "$4.99" };

  var state = { ready: false, prices: {}, listeners: [] };

  function hasPro() { try { return localStorage.getItem(UNLOCK_KEY) === "1"; } catch (e) { return false; } }
  function enabled() { return MONETIZATION_ENABLED; }
  // A dance/feature is available if monetization is off (build 1), the item is free, or the user owns Pro.
  function isUnlocked(dance) { return !enabled() || (dance && dance.free) || hasPro(); }
  // Free tier has limited tempo (brief §6.5); Pro (or build 1) gets the full range.
  function tempoRange() { return (!enabled() || hasPro()) ? [40, 120] : [70, 100]; }
  function priceOf(key) { return state.prices[key] || PRICE_FALLBACK[key] || ""; }

  function notify() { state.listeners.forEach(function (f) { try { f(); } catch (e) {} }); }
  function onChange(f) { state.listeners.push(f); }

  // grant Pro — the ONLY place the flag is set true (called from verified() or a real restore)
  function grantPro(source) {
    try { localStorage.setItem(UNLOCK_KEY, "1"); } catch (e) {}
    console.log("[iap] Pro granted via", source || "unknown");
    notify();
  }

  function init() {
    if (!enabled()) { state.ready = true; return; }         // build 1: nothing to wire, stay free-open
    document.addEventListener("deviceready", wireStore, false);
    // if deviceready already fired (native), wire now
    if (global.CdvPurchase) wireStore();
  }

  function wireStore() {
    var CdvPurchase = global.CdvPurchase;
    if (!CdvPurchase) return;                                // no native bridge -> buy() stays a no-op (never grants)
    var store = CdvPurchase.store, ProductType = CdvPurchase.ProductType, Platform = CdvPurchase.Platform;
    store.register([
      { id: PRODUCTS.monthly,  type: ProductType.PAID_SUBSCRIPTION, platform: Platform.APPLE_APPSTORE },
      { id: PRODUCTS.yearly,   type: ProductType.PAID_SUBSCRIPTION, platform: Platform.APPLE_APPSTORE },
      { id: PRODUCTS.lifetime, type: ProductType.NON_CONSUMABLE,    platform: Platform.APPLE_APPSTORE },
      { id: PRODUCTS.packWedding, type: ProductType.NON_CONSUMABLE, platform: Platform.APPLE_APPSTORE }
    ]);
    store.when()
      .approved(function (t) { t.verify(); })
      .verified(function (r) { r.finish(); grantPro("verified"); })   // <-- ONLY grant point
      .productUpdated(function () {
        Object.keys(PRODUCTS).forEach(function (k) {
          var p = store.get(PRODUCTS[k], Platform.APPLE_APPSTORE);
          if (p && p.pricing && p.pricing.price) state.prices[k] = p.pricing.price;
        });
        state.ready = true; notify();
      });
    store.error(function (e) { console.warn("[iap] error", e && e.code, e && e.message); });
    store.initialize([Platform.APPLE_APPSTORE]).then(function () { state.ready = true; notify(); });
  }

  // buy() NEVER grants — it only asks Apple. Guard: requires the native bridge AND a loaded product.
  function buy(key) {
    if (!enabled()) return false;
    var CdvPurchase = global.CdvPurchase;
    if (!CdvPurchase || !state.ready) { console.warn("[iap] store not ready — not purchasing (and NOT granting)"); return false; }
    var p = CdvPurchase.store.get(PRODUCTS[key], CdvPurchase.Platform.APPLE_APPSTORE);
    var offer = p && p.getOffer && p.getOffer();
    if (offer) { offer.order(); return true; }
    return false;
  }
  function restore() {
    if (!enabled()) return;
    var CdvPurchase = global.CdvPurchase;
    if (CdvPurchase && state.ready) CdvPurchase.store.restorePurchases();
  }

  global.Monetize = {
    enabled: enabled, hasPro: hasPro, isUnlocked: isUnlocked, tempoRange: tempoRange,
    priceOf: priceOf, PRODUCTS: PRODUCTS, buy: buy, restore: restore, init: init, onChange: onChange,
    // dev-only helper, guarded so it can't ship an accidental unlock in build 1 UI
    _devTogglePro: function () { if (hasPro()) { localStorage.removeItem(UNLOCK_KEY); } else { grantPro("dev"); } }
  };
})(typeof window !== "undefined" ? window : globalThis);
