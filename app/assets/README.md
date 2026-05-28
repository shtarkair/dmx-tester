# Assets

Expo expects `icon.png`, `splash.png`, `adaptive-icon.png`, and `favicon.png` in
this folder. The included `app.json` references them, but they're not bundled
with the project source. On first run Expo will warn about missing assets — you
can either drop your own images here (1024×1024 PNGs work) or remove the
`icon`/`splash`/`adaptiveIcon`/`favicon` keys from `app.json` to use Expo
defaults.
