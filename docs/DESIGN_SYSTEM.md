# Design System — "Clean Lab"

_Chosen by the CC on 2026-11-19 (style D3 = C · Clean Lab). Reference render: `style_options.html` (option C)._
_Personality: light, minimal, editorial, with a quiet tech edge. SP red is used sparingly as the signal colour, numbers are monospace, and there's a faint dot-grid texture._

## 1. Principles

1. **White space over borders.** Cards sit on a soft grey page and are separated by spacing plus 1 px hairlines.
2. **Red means "act now".** SP red appears only on primary actions, the brand mark and alerts that need attention. It's never decoration.
3. **Numbers are monospace.** Counts, times and room codes use JetBrains Mono, so they line up and feel "computing".
4. **One hero per screen.** Each screen has one obvious thing to do: Got it, +1, Redeem.
5. **Thumb-first on phones.** Primary tap targets are at least 64 px tall, in the lower half of the screen.

## 2. Tokens (Tailwind theme + CSS variables)

### Colour, light (default)

| Token                | Hex                          | Use                                              |
| -------------------- | ---------------------------- | ------------------------------------------------ |
| `page`               | `#EEF0F4`                    | App background (with dot grid at 70%)            |
| `surface`            | `#FFFFFF`                    | Cards, phone screen                              |
| `surface-2`          | `#F6F7F9`                    | Nested tiles, inputs                             |
| `line`               | `#E6E8EC`                    | Hairlines, borders                               |
| `ink`                | `#0F1115`                    | Primary text, **hero tap buttons** (black)       |
| `ink-2`              | `#3C4250`                    | Secondary text                                   |
| `muted`              | `#7A8191`                    | Labels, captions                                 |
| `accent` (SP red)    | `#D71F30` ⚠ placeholder      | Primary buttons, brand mark, change alerts       |
| `ok` / `ok-bg`       | `#0E7A43` / `#EAFAF1`        | Saved, OK status                                 |
| `busy` / `busy-bg`   | `#C81E2E` / `#FDE8EA`        | Busy room                                        |
| `quiet` / `quiet-bg` | `#2F5BEA` / `#E8EEFE`        | Quiet room                                       |
| `low` / `low-bg`     | `#A15C00` / `#FFF2DC`        | Low gift stock, warnings                         |
| `meter`              | `#0F1115` on track `#ECEEF2` | Neutral progress bars (red is reserved for busy) |

⚠ **Open item DS-1:** replace `accent` with the official SP brand red (and the SoC logo if one is provided) before Dry Run #2. It's a one-line token change.

### Colour, dark (user toggle, plus "follow system")

The same roles, inverted: `page #0E1013`, `surface #15171B`, `surface-2 #1C1F24`, `line #2A2D33`, `ink #F2F3F5`, `ink-2 #C4C8D0`, `muted #8A909C`, `accent #FF4A57`, hero tap = `#F2F3F5` with ink `#0F1115`. Status colours are lightened for contrast (`busy #FF6B76`, `quiet #7EA2FF`, `ok #4ADE80`, `low #FBBF24`). The dot grid drops to 40% opacity.

### Type

| Role                                                                                       | Font           | Size / weight                                                       |
| ------------------------------------------------------------------------------------------ | -------------- | ------------------------------------------------------------------- |
| Display (station names, page titles)                                                       | Space Grotesk  | 22–28 px / 700, tracking −0.01em                                    |
| Body / UI                                                                                  | Inter          | 14–15 px / 400–600                                                  |
| Numbers, times, room codes, kickers                                                        | JetBrains Mono | Kicker 10.5 px / 600 / +0.12em uppercase. Big counts 48–56 px / 700 |
| Fonts are self-hosted via `@fontsource` packages (no external font requests on event day). |

### Shape, space, depth

- Radius: cards 14 px, buttons 10 px, hero tap 22 px, pills fully round.
- Spacing scale: 4 · 8 · 12 · 16 · 24 · 32.
- Shadow: only on the primary button (`0 8px 20px rgb(215 31 48 / .22)`) and floating sheets. Cards are flat.
- Texture: `radial-gradient(rgb(20 30 60 / .10) 1px, transparent 1.2px) 0 0 / 16px 16px` on `page` only.

## 3. Components (built once, reused everywhere)

| Component                             | Notes                                                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `AppBar`                              | Brand mark (red square "SoC") + title + right chip (date / station picker)                            |
| `TabBar` (phone) / `SideNav` (laptop) | Contents depend on tier (wireframes §C)                                                               |
| `Card`, `Kicker`, `Stat`              | Stat = kicker + mono number + optional sparkline                                                      |
| `Button`                              | `primary` (red), `hero` (black, large), `secondary` (outline), `danger`                               |
| `TapPad`                              | Hero +1 / category tiles. Haptic feedback (`navigator.vibrate(10)`) where supported. Press scale 0.98 |
| `UndoToast`                           | Green bar with a countdown, auto-dismiss at 10 s                                                      |
| `SaveState`                           | Hidden when saved. Red "Not saved, retrying…" bar when pending > 2 s                                  |
| `ChangeAlert`                         | Pale red card, red dot, old → new, **Got it**                                                         |
| `StatusPill`                          | busy / quiet / ok / low                                                                               |
| `Meter`                               | Neutral bar. Turns busy-red or quiet-blue at the thresholds                                           |
| `DataTable`                           | Laptop tables. Stacks into cards under 700 px                                                         |
| `ConfirmTyped`                        | Danger dialogs that require typing RESET / WIPE                                                       |

## 4. Motion & accessibility

- Motion is limited to 120–180 ms ease-out on press and toast. It respects `prefers-reduced-motion`.
- All text pairs meet WCAG AA (contrast checked for both themes during the build).
- Focus ring: 2 px `accent` outline, offset 2 px.
- Status is never shown by colour alone: pills always carry a word (BUSY, QUIET, LOW).
