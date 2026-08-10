# UI Design System

## Component model

Two component kinds exist. **Primary** components serve one interaction purpose
(button, input, paragraph, slider) and each carries an icon *and* a text label
where the component type has a meaningful icon; icon-less types (paragraph,
plain label) omit it rather than forcing a placeholder. **Secondary**
components are containers: they arrange a list of Primary components, or nest
another Secondary component. Secondary components are the only unit that can
be hidden, relocated, or resized by the user (panels, toolbars, docked
groups).

## Layer

`layer` is not a style knob set per component — it is the nesting depth of
Secondary containers, computed automatically from the containment tree. The
root Secondary (e.g. the main toolbar) is `layer 0`; a Secondary nested inside
it is `layer 1`; a Secondary nested inside that is `layer 2`, and so on. Every
Primary component inherits the `layer` of its nearest enclosing Secondary — it
does not have its own independent layer.

This makes `layer` a single derived integer that both color and size read
from, without being set by hand anywhere in the component tree.

## Size

Perceived size differences are proportional, not absolute (Weber-Fechner) —
the same 4px change reads as significant at 16px and invisible at 200px. Size
tokens therefore step geometrically, not linearly:

```
size(layer) = baseSize * shrinkRatio^layer
```

Defaults: `shrinkRatio = 0.85`. Applies uniformly to padding, gap, icon size,
and font size, so a layer-2 panel's typography and spacing shrink together
and stay proportioned to each other.

Each size token has a `minSize` floor independent of the equation above — the
point past which the token stops shrinking and instead triggers collapse
(see below).

## Color

OKLCH lightness (`L`) is already perceptually uniform by construction, unlike
raw RGB — equal steps in `L` read as equal perceptual steps, so color does
**not** use the same geometric formula as size. It steps linearly:

```
L(layer) = clamp(baseL + sign * layer * Lstep, Lmin, Lmax)
```

There are exactly two color roles, kept deliberately open-ended-free per
the "as simple as possible" direction: `base` (neutral, every background)
and `accent` (OS-detected, see below). Hue and chroma stay fixed per role
— only lightness moves with layer, through the identical equation for
both. A `danger` role is deferred until an actual destructive action
exists to consume it, rather than built speculatively.

Text/icon color is not a third layer-stepped role — it's ink: whichever
of pure black or white clears the WCAG 2.x relative-luminance contrast
ratio more strongly against the specific background it's rendered on
(the real ratio, via culori's `wcagContrast` — an OKLCH lightness delta
alone isn't an equivalent stand-in for it). Ink doesn't need its own
equation because its only job is staying legible against whatever
background it sits on, not expressing nesting depth. A component with no
background of its own (Paragraph, Input's label prefix) computes ink
against whatever surface it's actually sitting on — its enclosing
Secondary's own background at that same layer.

Backgrounds one layer "deeper" than their surroundings (Button, Input's
field) resolve `base` at `layer + 1` rather than introducing a separate
"raised surface" concept — reusing the same equation for elevation that
nesting already uses.

`darkMode` comes from `window.matchMedia('(prefers-color-scheme: dark)')`,
listened to via its `change` event so the theme repaints live if the user
flips their OS setting while the app is open. It sets both `baseL` and
`sign`:

```
baseL = darkMode ? Lstep : 1 - Lstep
sign  = darkMode ? +1 : -1
```

`layer 0` sits exactly one `Lstep` off pure black or pure white, and each
deeper layer takes another `Lstep` in the same direction — `Lstep` is the
single constant governing both the base offset and the per-layer increment.
`Lmin`/`Lmax` clamp the band per role so deep nesting can't wash a surface
out to pure white or black.

The page canvas itself is `layer -1` in this same equation — not a special
case, just the one layer further toward the true extreme than layer 0
already is. A layer-0 Secondary needs to look visually distinct from the
bare page it sits on, and `L(-1)` gives exactly that for free: pure
black/white before the `Lstep` offset (or the extreme after `Lmin`/`Lmax`
clamping) rather than colliding with `L(0)`.

### Accent color

Accent color tries the OS accent color first, falling back to a curated
default when that isn't available:

1. Feature-detect with `CSS.supports('color', 'AccentColor')` — Chromium and
   Firefox recognize the keyword as valid syntax, Safari doesn't, so this is
   a clean pass/fail signal rather than guessing from a resolved value.
2. If supported, render an offscreen element with `color: AccentColor`, read
   the resolved value via `getComputedStyle`, and convert it to OKLCH.
3. If unsupported (or conversion fails), fall back to a curated default
   accent hue baked into the theme, run through the same `L(layer)`
   equation as the base role.

## Collapse

A Secondary container computes its required minimum size from its children's
`minSize` floors (sum along the layout axis, max across it). When available
space drops below that requirement, the container collapses its Primary
children:

1. Each Primary switches to icon-only representation, dropping its text
   label. Its collapsed `minSize` floor is much smaller than expanded.
2. A Primary with no icon (paragraph, plain label) collapses to a
   fixed-width ellipsized fragment instead.
3. If children still don't fit after every Primary has collapsed, the
   container falls back to scrolling along its own layout axis rather than
   clipping or hiding anything — children don't flex-shrink past their
   collapsed size, so the browser overflows into a scrollbar instead of
   squashing content.

Only the root Secondary (`layer 0`, no enclosing Secondary) measures its
own available space — a nested Secondary is always wrapped in
`flexShrink: 0` by its parent, so its box can never actually be squeezed
by row layout, and self-measuring it is not just unnecessary but actively
wrong: collapsing shrinks its content, which shrinks its own box, which a
naive self-measurement would misread as "still too small" and get stuck
on even after the real cause goes away. Every nested Secondary instead
purely inherits its collapse state from its nearest ancestor Secondary —
once the root collapses, every Primary nested beneath it collapses too,
at any depth.

A nested Secondary still contributes to whether its *ancestor* needs to
collapse: it reports its own aggregate footprint (the sum of its own
children, expanded and collapsed) up to the ancestor's threshold
calculation, the same way a Primary reports its own `minSize`. So the
root's collapse decision accounts for nested subtrees even though only
the root does any actual measuring.

A registering Primary measures whichever axis its nearest enclosing
Secondary actually lays children out on and compares against — width for
`direction="row"`, height for `direction="column"`. Collapsing only ever
hides a label horizontally; it never changes how tall a Primary renders.
So along the height axis, the collapsed footprint a Primary reports is
just the same measured size as its expanded one — only the width axis
needs the analytical icon/ellipsis-based formula.

## Animation speed

```
duration(layer) = baseDuration * durationRatio^layer
```

Deeper layers are physically smaller on screen, so they can complete the same
perceived motion in less time — this is an optional refinement, not a
requirement; a single `baseDuration` per motion type (open/close, hover,
collapse-transition) is a valid starting point if per-layer duration scaling
turns out to be unnecessary in practice.
