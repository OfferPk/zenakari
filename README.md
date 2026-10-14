# ZenAkari (石灯籠 / Light Up / 美術館)

> A calm, meditative Japanese Light Up (Akari) lantern illumination logic puzzle.

[![CI](https://github.com/OfferPk/zenakari/actions/workflows/ci.yml/badge.svg)](https://github.com/OfferPk/zenakari/actions/workflows/ci.yml)
[![Deploy GitHub Pages](https://github.com/OfferPk/zenakari/actions/workflows/pages.yml/badge.svg)](https://github.com/OfferPk/zenakari/actions/workflows/pages.yml)
[![Android Build](https://github.com/OfferPk/zenakari/actions/workflows/android.yml/badge.svg)](https://github.com/OfferPk/zenakari/actions/workflows/android.yml)

**Play in your browser:** [https://offerpk.github.io/zenakari/](https://offerpk.github.io/zenakari/)  
**Download Android APK:** [GitHub Actions Artifacts](https://github.com/OfferPk/zenakari/actions)

---

## The Art of Akari (Light Up)

In the quiet evening Japanese garden, place traditional stone lanterns (*Tōrō* 石灯籠) along open pathways so every stone is illuminated by gentle warm rays.

1. **Radiant Lantern Rays**: Each placed lantern casts light horizontally and vertically across unobstructed pathway cells until blocked by a stone wall or garden edge.
2. **No Direct Sightline**: No two lanterns may illuminate one another. There cannot be an unblocked straight line of sight between any two lanterns.
3. **Numbered Stone Walls**: A stone wall with a number (0, 1, 2, 3, 4) specifies exactly how many lanterns must touch it orthogonally (North, South, East, West). Unnumbered black walls have no adjacent restriction.
4. **Complete Harmony**: Every open pathway cell in the garden must receive light from at least one lantern.

---

## Features

- **50 Handcrafted Levels**: 5 difficulty packs ranging from gentle introductory courtyards to intricate sanctuary grids:
  - **Twilight Courtyard** (5×5, Levels 1–10)
  - **Lantern Path** (6×6, Levels 11–20)
  - **Stone Torii** (7×7, Levels 21–30)
  - **Moss Garden** (8×8, Levels 31–40)
  - **Zen Sanctuary** (9×9, Levels 41–50)
- **100% Unique Solutions**: All levels verified by an automated backtracking constraint solver to guarantee a unique, elegant solution.
- **Procedural Garden Acoustics**: Built with pure Web Audio API without external audio assets. Real-time synthesis of soft stone taps, warm harmonic lantern hums, crisp bamboo clacks, and resonant Japanese temple singing bells (*Rin Gong*).
- **Player-Friendly Controls**:
  - Tap to place lanterns or dot markers.
  - Quick toggle button between Lantern (🏮) and Dot (•) modes.
  - Unlimited Undo and Board Reset.
  - Smart Deductive Hint engine pointing out forced placements and rule deductions.
- **Zero-Network & Privacy Respecting**: 100% client-side offline PWA with service worker caching. No tracking, no ads, no analytics.

---

## Local Development & Build

### Prerequisites
- Node.js 18+
- npm 9+

### Commands

```bash
# Run logic unit tests
npm test

# Build static web distribution
npm run build
```

---

## License

MIT License. Copyright (c) 2026 OfferPk.
