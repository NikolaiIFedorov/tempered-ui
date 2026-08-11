# UI Design System

## Component model

Two component kinds exist. **Primary** components serve one interaction purpose
(button, input, paragraph, slider) and each carries an icon *and* a text label
where the component type has a meaningful icon; icon-less types (paragraph,
plain label) omit it rather than forcing a placeholder. **Secondary**
components are containers: they arrange a list of Primary components, or nest
another Secondary component. Secondary components are the only unit that can
be hidden, reordered, or resized by the user (panels, toolbars, docked
groups) — a Primary's own footprint is always a function of its content and
its enclosing Secondary's collapse state, never something the user drags
independently.

A Primary that takes parameters (an Extrude button with depth and twist)
isn't a third component kind — it's a plain Secondary (for its background,
padding, radius, and collapse cascade) containing the button plus one
Input per parameter, with a dedicated `StagedAction` component owning
which params currently show. Nesting the params inside the button's own
box, rather than placing them beside it as a sibling, is what makes
revealing them read as "this button's own detail" instead of an unrelated
adjacent control, and gives each parameterized action its own independent
stage even when several sit in the same toolbar. This is composition on
top of existing primitives, not a new component kind — a parameter schema
declared next to a callback (not reflection over the callback itself,
which can't recover a type, range, or label to generate a real control
from) is enough to build it entirely in application code.

**N-stage collapse.** With N params there are N+1 stages — all shown,
down to none — and `StagedAction` owns its own drag handle to move
between them, rather than reusing Secondary's binary `resizable`: dropping
one parameter at a time as space shrinks is a different decision than
Secondary's "is there room for everything or not," not a generalization
of it. The drag still tracks a start width plus the raw pointer delta the
same way Secondary's binary snap does; the only difference is checking N
midpoints (one between each pair of adjacent stage widths) instead of
one, jumping to whichever stage the cursor has crossed toward. Once every
param is hidden, the *enclosing Secondary's* ordinary collapse-to-icon
behavior takes the final step (dropping the button's own label) — so this
mechanism only ever governs the params, chaining into collapse rather
than duplicating it. Params drop from the end of the list first (most
important parameter declared first survives longest).

Each stage width is measured directly off real layout (a ref on the
button and one on each param, read via `getBoundingClientRect` once,
while every param is still visible at mount) rather than duplicating
Secondary's internal gap token — reading the actual rendered gap between
the button and the first param stays correct regardless of what that
token is tuned to. The ref used purely for measurement must have a real
box: `display: contents` (as used elsewhere to keep a wrapper transparent
to flex layout) generates no box at all, so `getBoundingClientRect` on
such an element always reads back zero — a real, not hypothetical, bug
hit while building this.

Hiding a param must be purely visual (`display: none`), never a
conditional unmount — every registered min-size footprint is meant to be
a fixed `{expanded, collapsed}` pair, true regardless of current render
state, since that pair is what an ancestor's own collapse *decision*
reads. Unmounting a param's Input on hide un-registers it, shrinking the
enclosing Secondary's own reported footprint — which can shrink the
root's required width enough to un-collapse it, which re-expands the
enclosing Secondary, remounting the Input, growing the footprint back,
re-collapsing the root — a real infinite render loop, not a hypothetical
one, hit and confirmed live while building this (dozens of flips per
second). `StagedAction`'s own resize handle has the same accounting
concern Secondary's does: it takes real space the ancestor's threshold
math needs to know about, so it registers its own fixed-width min-size
entry directly rather than getting this for free the way a Primary would.

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

`shrinkRatio` is not one shared constant — it's tuned per token. Padding
uses `0.6` (a deliberately fast shrink, so nesting depth reads as an
obvious step rather than something you have to look closely to notice);
gap, icon size, and font size use a gentler `0.85`, since those need to
stay legible/usable rather than dramatically shrink. All of them share
the same equation shape, just calibrated differently per token.

Each size token has a `minSize` floor independent of the equation above — the
point past which the token stops shrinking and instead triggers collapse
(see below).

Fillets (border-radius) aren't their own token — every component that
has padding derives its corner radius directly from that same computed
padding value (`radius = padding * 0.5`), so rounding scales with layer
depth for free instead of needing to be kept in sync separately.

Any element that carries both its own padding and a `width`/`maxWidth`
constraint (Secondary's flex row) needs `box-sizing: border-box` — with
the CSS default (`content-box`), a percentage `maxWidth` caps the content
area only, so padding still renders on top of that cap and the real
border box ends up padding-sized past the intended limit.

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

The page canvas is conceptually one layer further toward the true extreme
than layer 0 — but it's resolved as its own thing (`resolveCanvas`), not
as `L(-1)` through the clamped equation: `Lmin`/`Lmax` exist to stop deep
*nesting* from washing a surface out to an extreme, and applying that same
clamp to the canvas would cut its distance from layer 0 down to a fraction
of `Lstep` instead of the full step, since layer 0 already sits close to
the clamp boundary. The canvas is the one thing that's supposed to reach
the true extreme (pure black in dark mode, pure white in light) — it
isn't a nested surface at risk of washing out, so it isn't clamped.

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

Only a root Secondary (`layer 0`, no enclosing Secondary) with
`direction="row"` measures its own available space. A nested Secondary is
always wrapped in `flexShrink: 0` by its parent, so its box can never
actually be squeezed by row layout, and self-measuring it is not just
unnecessary but actively wrong: collapsing shrinks its content, which
shrinks its own box, which a naive self-measurement would misread as
"still too small" and get stuck on even after the real cause goes away.
The same self-referential trap hits a root with `direction="column"` for
a different reason: a block element always gets a genuine width from its
containing block in ordinary page flow, but its height is intrinsic
(`auto`) unless something explicitly constrains it, so there's no real
external height to measure against — a column-direction root never
self-measures and simply stays expanded. Every Secondary that doesn't
self-measure instead purely inherits its collapse state from its nearest
ancestor Secondary — once a measuring root collapses, every Primary
nested beneath it collapses too, at any depth.

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

## Resize

Only a Secondary is user-resizable — a Primary's size always follows from
its content and its enclosing Secondary's collapse state, never from its
own drag handle. Dragging a Secondary's handle toggles it between fully
expanded and fully collapsed, snapping partway through the drag, rather
than resolving to an arbitrary width: a Secondary's job is organizing its
children, and how much of that organization is currently visible is
inherently a two-state decision — the same one collapse already makes for
it, just now user-driven instead of purely space-driven. `resizable`
grants a Secondary a drag handle; it doesn't broadcast anything downward,
since no Primary needs the capability.

The drag still tracks the cursor the way a continuous resize would (a
start width plus the raw pointer delta), but only to decide which side of
the midpoint between the expanded and collapsed footprints the cursor
lands on — the box snaps to that footprint's exact width live as soon as
the midpoint is crossed, not to wherever the cursor currently sits. This
mirrors the read of the reordering swap-preview in Reposition: the result
is decided by a threshold crossing, not tracked continuously.

**Root Secondary (`layer 0`, `direction="row"`).** Snapping to collapsed
sets the measurement wrapper's width to the exact `requiredCollapsed`
value — safe, since `ResizeObserver` reporting that back is nowhere near
the collapse threshold. Snapping to expanded, however, sets the wrapper's
width back to `100%` (real measured space) rather than an exact
`requiredExpanded` value: the root re-derives its own collapse by
comparing `ResizeObserver`'s measured width against that exact same
threshold, so forcing the two to match precisely is a knife's edge — real
subpixel rounding in what the browser reports back can read a hair under
the threshold and immediately re-collapse it. This is the same class of
bug a continuous drag used to hit trying to clamp its ceiling at exactly
`requiredExpanded`; binary snapping doesn't remove the risk, it just
means every "expanded" drag would land exactly on that edge instead of
occasionally, so deferring to `100%` (the same value used before any drag
at all) sidesteps it entirely rather than trying to out-precision it.

**Nested Secondary.** It never self-measures (see Collapse), so both snap
states set its own flex row's width directly to an exact footprint value,
and its collapse decision is the literal boolean the drag landed on —
`manualCollapsed`, not something recomputed by measuring the row's own
rendered size. That's combined with the inherited ancestor cascade via
OR — a nested Secondary can collapse because *it* was dragged closed, or
because its ancestor was, whichever comes first. This OR is safe here in
a way it isn't for self-measurement: the state came from a direct pointer
threshold crossing, not from a box measuring its own rendered size, so
there's no self-referential trap, and no knife's edge either — nothing
here re-derives collapse from a measurement of the snapped width.

A resize handle nested inside an ancestor's own drag surface — e.g. a
resizable nested Secondary's handle sitting inside the root's reorderable
item wrapper — needs `event.stopPropagation()` in its pointer handlers;
without it, the pointerdown bubbles up and the ancestor's own handler
(reorder, in that example) steals pointer capture for itself, silently
breaking the nested drag.

A drag ending is never trusted to arrive as a clean `pointerup` alone —
window blur, a native drag gesture stealing capture, and similar real
browser situations can all cause it to go missing, which would otherwise
leave the drag permanently stuck (the handle stays visually active, and
the next hover keeps moving the size). Every `pointermove` handler also
checks `event.buttons`, the live truth of whether a button is actually
still held, and ends the drag the instant it reads `0` even without a
matching end event. `pointercancel` is handled the same way as a safety
net for browser-cancelled gestures. Unlike Reposition, this doesn't need
window-level listeners — a resize handle's own DOM position never moves
during its drag (only the row's width changes around it), so it isn't
exposed to the `lostpointercapture` failure mode reordering has.

## Reposition

An `onReorder` Secondary makes its direct children draggable to reorder
them among their siblings. It's controlled, the same way a controlled
`<input>` reports changes instead of owning its value: Secondary handles
the drag gesture and gives live visual feedback, but the actual order
lives wherever the caller's data already lives — `onReorder(newKeyOrder)`
fires on release, and Secondary doesn't mutate anything on its own.

While dragging, each pointer move compares the pointer's position along
the layout axis against every other item's live midpoint and splices the
dragged key to that slot — giving an instant preview during the drag
rather than waiting for the caller's next render. This needs a stable
key per child to be meaningful; children without an explicit `key` fall
back to their index, which isn't a meaningful drag target.

Unlike Resize, reordering doesn't use per-element pointer capture at all
— it tracks the drag with `pointermove`/`pointerup`/`pointercancel`
listeners on `window` instead, added on pointerdown and removed once the
drag ends. This isn't a style choice: reordering moves the dragged item's
own DOM node to a new sibling position on every step (that's how the live
preview works), and moving a node that holds native pointer capture makes
the browser silently drop that capture mid-drag. Once capture is gone,
the eventual release gets routed by ordinary hit-testing to whatever's
actually under the cursor rather than the item that started the drag —
which could be a different item, or nothing at all — so a handler
attached only to that item never sees it, and the drag looks permanently
stuck (dimmed, and still reorderable on the next hover). Listening on
`window` sidesteps this: delivery no longer depends on which element is
under the cursor or where the dragged node currently sits in the tree.

A missing `pointerup` is additionally handled the same way described in
Resize, as a last-resort backstop: a stray `pointermove` with no button
held commits the live preview as if it were a real release. A genuine
`pointercancel` reverts to the caller's actual order without calling
`onReorder`, since that's an aborted gesture rather than an intentional
drop.

## Animation speed

```
duration(layer) = baseDuration * durationRatio^layer
```

Deeper layers are physically smaller on screen, so they can complete the same
perceived motion in less time — this is an optional refinement, not a
requirement; a single `baseDuration` per motion type (open/close, hover,
collapse-transition) is a valid starting point if per-layer duration scaling
turns out to be unnecessary in practice.
