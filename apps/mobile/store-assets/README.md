# Store assets — SGS Land mobile

This folder collects assets needed for App Store Connect and Google Play
Console submission (Sprint 7 / Task #57).

## Structure
```
store-assets/
  listing-vi.md           ← Vietnamese title/subtitle/description/keywords
  README.md               ← (this file)
  ios/
    6.7/                  ← 1290 × 2796 PNG, ≥3 / ≤10 screenshots
    6.5/                  ← 1242 × 2688 PNG (fallback if 6.7 missing)
    appicon-1024.png      ← App Store icon, no alpha
  android/
    phone/                ← 1080 × 1920 (or higher) PNG, ≥2 / ≤8 screenshots
    tablet7/              ← 1200 × 1920 PNG, optional
    feature-graphic.png   ← 1024 × 500 PNG, mandatory
    icon-512.png          ← 512 × 512 PNG with alpha
```

## How to capture
1. Run `pnpm --filter @sgsland/mobile start`, open the app on a real device
   that matches the target spec (or the iOS simulator with the matching
   device preset).
2. Reach each of the 6 screens listed in `listing-vi.md`.
3. iOS: Cmd+S in the simulator window saves a 3x PNG into the desktop;
   move into `store-assets/ios/6.7/`. Android: `adb exec-out screencap -p
   > screen.png` then drop into the right size folder.
4. Crop / pad to the required resolution if needed (Figma artboard
   `store-assets-frames.fig` or any image tool).

## Icons
- `ios/appicon-1024.png` — square, no alpha, no rounded corners (Apple
  applies the mask).
- `android/icon-512.png` — square, alpha allowed.

## Generated mockup assets (Sprint 7 follow-up #62)
The PNGs currently in `ios/` and `android/` are brand-consistent **mockups**
generated programmatically (`.local/scripts/gen-store-assets.mjs`) so that
store submission can proceed without blocking on a device-capture session.
They use the real palette/typography/copy from `listing-vi.md`. Replace any
of them with real device captures whenever a simulator/device session is
available — keep the same filenames and sizes so the listing stays valid.

## What we DON'T ship through the app
- No third-party ad SDKs.
- No data sale / brokering.
- Analytics is gated behind the App Tracking Transparency prompt; if the
  user denies, the analytics ID stays unavailable.
