<div align="center">

<img src="assets/feathers.svg" alt="Bryant Leung, falling feathers" width="100%">

# Bryant Leung · Portfolio

**A theatrical, clockwork portfolio site**, staged like a magical-girl labyrinth.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white&labelColor=0b0914)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white&labelColor=0b0914)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white&labelColor=0b0914)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white&labelColor=0b0914)

</div>

---

## What it is

My personal portfolio. It opens with a short 2D anime-style cut-in, then drops you into a navigation wheel inspired by the Walpurgisnacht stage labyrinth: a giant clockwork dial, pivoted off-screen, that turns a quarter at a time to bring each chapter of the site into view.

## Highlights

### 🎬 Entrance sequence
An ~8-second, nine-shot 2D intro drawn on an HTML canvas, with girders, a cathedral arch and drifting feather particles animated on scroll. It plays once per session; the replay button in the top-right corner runs it again.

### ⚙️ Labyrinth navigation (`LabyrinthNav`)
- **Four stages on one wheel.** Profile, Projects, Experience & Stack, and Contact & CV each take a 90° quadrant of a single 360° dial.
- **A curved sweep.** The pivot sits low-left, so the active quarter-arc cuts diagonally across the screen. Each forward step turns the wheel +90° clockwise: the next chapter swings in from the top-left as the last one leaves to the bottom-right.
- **It never unwinds.** Rotation is a running step count, so going from IV back to I keeps turning forward (270° → 360°).
- **Labels stay level.** Every node counter-rotates with the same 900 ms `cubic-bezier(0.22, 1, 0.36, 1)` timing as the wheel, so text stays horizontal throughout the turn.
- **Detail cards.** Clicking a node opens a glass card (a right-hand column on desktop, a bottom sheet on mobile) with details, tags and links. Clicking a faded node in a neighbouring stage turns the wheel there.
- **Several ways to move.** The I–IV stage selector, Prev/Next buttons, arrow keys, and debounced scroll or trackpad gestures all turn the wheel.
- **Gecko and seal.** A twin-lizard seal sits at the dial's centre, and a gecko traverses the wheel persistently, layered both over and under the clockwork.
- **Accessible by default.** Nodes and controls are real buttons, stage changes are announced to screen readers, and `prefers-reduced-motion` turns the animations off.

### 🔊 Sound
Off by default. The sound toggle starts a zero-dependency Web Audio engine: an original procedural 3/4 baroque waltz in G harmonic minor (bass, plucks, choir pad, celesta lead) plus clockwork SFX on wheel turns. No `AudioContext` is created until sound is enabled, so browser autoplay policies are respected.

### 🎨 Palette

| Role | Colour |
|---|---|
| Stage backdrop | `#0b0914` obsidian plum |
| Active paths, unlocked nodes | `#f5b942` tarnished gold |
| Inactive quadrants | `#8b84b0` muted violet at 45% opacity |
| Selection | `#e0457b` crimson-magenta |

## Getting started

Requires Node `^20.19` or `>=22.12` (Vite 8).

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Type-checks (`tsc -b`), then builds to `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | Runs oxlint |

### Deploying
Production metadata and favicon live in `index.html` and `public/favicon.svg`. SPA rewrites are included for both Vercel (`vercel.json`) and Netlify (`public/_redirects`).

## Project structure

```
src/
├── App.tsx                    # Entrance → labyrinth hand-off, replay button
├── components/
│   ├── EntranceSequence.tsx   # 2D canvas intro
│   ├── LabyrinthNav.tsx       # Circular four-stage navigation map, gecko traversal
│   ├── TwinLizardSeal.tsx     # Centre seal (geometry in lizardGeometry.ts)
│   └── entranceKey.ts         # Session key for play-once intro
├── data/
│   ├── profile.ts             # All site copy: bio, projects, experience, skills
│   └── themes.ts              # Per-stage theme tokens
├── hooks/                     # useReducedMotion, useMediaQuery
└── utils/
    └── soundEngine.ts         # Procedural waltz + clockwork SFX (Web Audio)
public/
├── cv.pdf                     # Linked from the Contact & CV stage
├── favicon.svg
└── _redirects                 # Netlify SPA rewrite
```

## Editing content

All copy lives in [`src/data/profile.ts`](src/data/profile.ts); components never hard-code it. Edit a project, role or skill there and the labyrinth nodes and detail cards update. To replace the CV, swap `public/cv.pdf`.

## Credits

- The art direction is a fan homage to the witch labyrinths of *Puella Magi Madoka Magica*. Its characters and setting belong to their respective rights holders.

---

<div align="center">

Built by **Bryant Leung** · [GitHub](https://github.com/bryant-leung) · [LinkedIn](https://www.linkedin.com/in/bryant-leung)

</div>
