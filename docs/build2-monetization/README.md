# Build 2 — monetization (NOT SHIPPED)

Nothing in this folder is loaded by the app. `www/` has no paywall, no product
IDs, no Restore control, and no price copy, and `package.json` has no
`cordova-plugin-purchase`. Build 1 ships free and says so nowhere, because it
doesn't need to — there is no locked content to explain.

`iap.js` is the ChordLoop-pattern Pro-gating module, parked here verbatim for
whenever monetization actually ships. Turning it on is **not** a matter of
copying it back:

1. Create the SKUs in App Store Connect first (subscription group + lifetime +
   packs) and confirm they are **Ready to Submit** — a product ID that isn't
   live in ASC makes every buy button dead, which is a 2.1 reject.
2. `npm i cordova-plugin-purchase` — without it `CdvPurchase` is undefined.
3. Copy `iap.js` to `www/js/`, add the `<script>` tag back to `www/index.html`
   ahead of `app.js`, and flip `MONETIZATION_ENABLED = true`.
4. Re-add the purchase UI (paywall overlay + a **Restore purchases** control —
   Apple requires Restore for non-consumables).
5. Grant Pro **only** inside `store.when().verified()`. Never from `buy()`,
   never from a guard that can run before the native bridge loads.
6. Re-run `scripts/apple-review-audit.sh` — section A3 checks all of the above.

The paywall/gating UI that used to live in `www/js/app.js` is in git history:
`git show 8a5b5dc -- www/js/app.js www/index.html`.
