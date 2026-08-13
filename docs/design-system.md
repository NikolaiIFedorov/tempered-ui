# UI Design System

## Component model

Two component kinds exist. **Primary** components serve one interaction purpose
(button, input, paragraph, slider) and each carries an icon *and* a text label
where the component type has a meaningful icon; icon-less types (paragraph,
plain label) omit it rather than forcing a placeholder. **Secondary**
components are containers: they arrange a list of Primary components, or nest
another Secondary component. Secondary components are the only unit that can
be hidden or reordered by the user (panels, toolbars, docked groups) — a
Primary's own footprint is always a function of its content and its
enclosing Secondary's collapse state.

A Secondary's contents are declared as data, not JSX children. `Secondary`
takes an `items: SecondaryItem[]` prop — each entry is a `{ kind, key?, props }`
record naming which Primary (or nested Secondary) it stands for and the exact
props that component takes — and `Secondary` is the only place that ever
constructs the corresponding `<Button>`/`<Input>`/`<Paragraph>`/`<Secondary>`
element from it. This isn't a style preference: a JSX expression's static type
is always erased to `ReactElement<any, any>` the moment a tag is written
(`JSX.Element extends React.ReactElement<any, any>`), so nothing downstream
can ever distinguish "a real `<Button>`" from "any other element" through the
type system — a `children: ReactNode` contract (or any prop typed as a union
of specific `ReactElement<P>`s) accepts literally anything once a JSX tag
produces the value, regardless of how the union is written. Plain data doesn't
go through that erasure: `props` is checked against the real `ButtonProps`/
`InputProps`/`ParagraphProps` interface at the call site, so a missing
required field or an invented `kind` fails to compile. Adding a new Primary
means adding its variant to `SecondaryItem` and a case to `Secondary`'s
internal render switch — both in `Secondary.tsx`, nowhere else.

`SecondaryImpl` is the untyped rendering/measurement engine `Secondary`
delegates to (still keyed off plain `ReactNode` children). It stays exported
only so tests can drive the collapse/registration machinery directly with
synthetic probe components that aren't real Primaries — app code should
always use `Secondary`, never `SecondaryImpl`.

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
gap and font size use a gentler `0.85`, since those need to stay
legible/usable rather than dramatically shrink. All of them share the
same equation shape, just calibrated differently per token.

An icon isn't sized by its own token at all — `PrimaryContent` sizes its
icon wrapper to `1em`, tying it directly to whatever font-size is
actually active in context (a Primary's inherited default, Paragraph's
own layer-scaled size, ...) rather than tracking it separately. This
also keeps it square, since both dimensions use the same value. The
wrapper needs an explicit `display` (`inline-block`, not the default
`inline`) for this to work at all — a plain inline element ignores
`width`/`height` entirely, silently discarding the `1em` sizing and
leaving the icon's own `width: 100%` (set via a `.primary-icon > svg`
CSS rule, so it fills the wrapper regardless of whatever width/height an
individual icon's own SVG declares) with no real box to resolve
against — a real bug hit live as a giant, wrongly-scaled icon in
collapsed mode specifically, where this wrapper renders as the outermost
element rather than getting free blockification as a flex item.

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
   label — its actual rendered size shrinks accordingly, but this is a
   rendering decision, not something separately registered: the threshold
   that triggered the collapse in the first place is based purely on each
   Primary's *expanded* `minSize`.
2. Paragraph is the one Primary that never switches to a discrete
   collapsed form and never registers a `minSize` at all: collapsing exists
   to reclaim space some Primary genuinely needs (an icon fallback, a
   narrower field), but Paragraph has no icon to fall back to and no hard
   minimum it's protecting. Ordinary text wrapping already lets it use
   however much width it's given, so it just shrinks with its container
   instead of truncating to an ellipsized fragment — including under a
   `forceCollapsed` cascade from an ancestor, since the same "not the kind
   of problem collapse solves" reasoning applies regardless of what
   triggered the collapse.
3. If children still don't fit after every other Primary has collapsed, the
   container falls back to scrolling along its own layout axis rather than
   clipping or hiding anything — children don't flex-shrink past their
   collapsed rendered size, so the browser overflows into a scrollbar
   instead of squashing content. This is ordinary CSS (`flexShrink: 0` +
   `overflow: auto`), not something computed — nothing needs to know in
   advance how large a collapsed row will be.

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
children's expanded sizes) up to the ancestor's threshold calculation, the
same way a Primary reports its own `minSize`. So the root's collapse
decision accounts for nested subtrees even though only the root does any
actual measuring.

A registering Primary measures whichever axis its nearest enclosing
Secondary actually lays children out on and compares against — width for
`direction="row"`, height for `direction="column"`. Only one number is
ever registered per Primary (its expanded size along that axis) — there's
no separate collapsed size to track, since the collapse threshold is only
ever compared against the expanded requirement in the first place.

A `direction="column"` Secondary's children stretch to match whichever
sibling is widest — ordinary flexbox `align-items: stretch` along the
cross axis, ostensibly free, except Button's `<button>`, Input's outer
`<label>`, and Secondary's own row are all inline-level (or explicitly
`fit-content`-sized) boxes that don't actually fill a stretched parent on
their own. All three set `width: 100%` (plus `box-sizing: border-box` so
padding doesn't push them past it) specifically when the *enclosing*
Secondary's direction is `"column"` — a `direction="row"` toolbar's cross
axis is height, not width, so this never applies there, and nothing about
a row's appearance changes. Secondary reads this via `useSecondaryDirection()`
*before* providing its own `DirectionProvider` for its children, the same
ambient "what does my parent use" read Button/Input already do — a
self-measuring root has no parent stretch to speak of, so it's excluded
regardless of what that read returns. This is how nested sections (each
its own Secondary) end up a uniform width instead of each sizing to its
own content independently. For Input specifically, the field is "the part
that gets wider," not the label or the gap between them: the field's own
`flexGrow: 1` (its `width` stays as the floor/flex-basis) lets it grow
into whatever space stretching opens up, while the label keeps its
natural content width via `flexShrink: 0` — landing every field's left
edge at a consistent column and its right edge flush with the container,
rather than the label stretching or a gap opening up between label and
field.

Several independent root Secondaries (e.g. separate toolbars/panels
positioned around a page shell, not nested inside one common container)
can't coordinate a shared "not enough room overall" decision purely from
each one's own measurement — and a `direction="column"` root in
particular never self-measures at all, so left alone it has no way to
collapse in response to anything. `forceCollapsed` is an explicit
override, ORed into whatever collapse decision a Secondary would
otherwise reach on its own, for a caller that wants a set of these
independent roots to collapse and expand together: it computes one
shared signal itself (e.g. a single window-width breakpoint) and passes
it to each of them. Passing it only to each independent root is enough —
a nested Secondary still cascades collapse from `ancestorCollapsed` the
same way it always has, so a `forceCollapsed` root's descendants collapse
too without needing the prop threaded down to each of them individually.

A `direction="row"` root that's part of such a shared-signal set should
also get `selfMeasure={false}`. Left at its default, a row root keeps
running its own independent `ResizeObserver`-driven collapse decision
*alongside* `forceCollapsed` (the two OR together) — usually harmless, but
wrong when several roots are meant to flip in lockstep off one breakpoint:
a root that happens to sit in a flexible layout track (e.g. a CSS grid
column sized `1fr`) has its own measured width shrink at a different rate
than the window itself, so it can cross its own threshold before or after
its siblings cross the shared one, producing a staggered collapse even
though every root received the same `forceCollapsed` value. Setting
`selfMeasure={false}` drops a row root's own measurement entirely, so
`forceCollapsed` becomes its sole source of truth — the same footing a
`direction="column"` root already has by construction.

A self-measuring root's split into an outer measurement wrapper and an
inner, visually-styled row is an implementation detail a caller should
never need to know about: `className`/`style` are applied to whichever of
the two is genuinely outermost (the wrapper, for a self-measuring root;
the row directly, otherwise), so `<Secondary>` can be positioned or
spaced as one atomic unit — `style={{ gridArea: 'x' }}`, margin, absolute
positioning — without a caller ever needing its own wrapper `<div>` just
to carry layout props Secondary should have taken itself. The wrapper
also never intercepts pointer events on its own — only the visible row
does — since the wrapper's true available-space width is often much
larger than what's actually rendered inside it (e.g. a small floating
panel measured against a full canvas behind it); pointer-events: none
lets clicks pass through the wrapper's empty space to whatever's behind
it rather than being silently swallowed by an invisible box.

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

Reordering doesn't use per-element pointer capture at all — it tracks the
drag with `pointermove`/`pointerup`/`pointercancel` listeners on `window`
instead, added on pointerdown and removed once the drag ends. This isn't
a style choice: reordering moves the dragged item's own DOM node to a
new sibling position on every step (that's how the live
preview works), and moving a node that holds native pointer capture makes
the browser silently drop that capture mid-drag. Once capture is gone,
the eventual release gets routed by ordinary hit-testing to whatever's
actually under the cursor rather than the item that started the drag —
which could be a different item, or nothing at all — so a handler
attached only to that item never sees it, and the drag looks permanently
stuck (dimmed, and still reorderable on the next hover). Listening on
`window` sidesteps this: delivery no longer depends on which element is
under the cursor or where the dragged node currently sits in the tree.

A missing `pointerup` is additionally handled as a last-resort backstop:
every `pointermove` handler also checks `event.buttons`, the live truth
of whether a button is actually still held, and a stray move that reads
`0` commits the live preview as if it were a real release — window blur,
a native drag gesture stealing capture, and similar real browser
situations can all cause the end event itself to go missing. A genuine
`pointercancel` reverts to the caller's actual order without calling
`onReorder`, since that's an aborted gesture rather than an intentional
drop.

## Live tokens

Every tunable constant across the design system — each component's own
`SizeScale` objects (`baseSize`/`shrinkRatio`/`minSize`), radius ratios,
the color roles (`baseRole`/`accentRole`), and `Lstep` — lives in exactly
one place: `TokensProvider`/`useTokens()` for size, `ThemeProvider`/
`useTheme()` (already the home of color) for color. No component keeps
its own hardcoded copy; each reads its scale from `useTokens()` (or
`useTheme()` for color) on every render, the same way every other
context-driven value already works. A settings surface that reads and
writes through the same hooks is editing the real, live value everything
else renders from — not a separate snapshot that would need syncing back.

Both providers default to real, current values outside a provider —
`DEFAULT_TOKENS` for size, the previous hardcoded color roles for
theme — consistent with every other design-system hook, with a no-op
setter where there's no state to update.

A token changing doesn't automatically make every dependent number
correct on its own: values read directly in JSX (`padding`, `gap`,
`fontSize`, ...) update for free on the next render, but a component that
also *measures itself* to register a min-size (Button, Input, Paragraph)
or *recomputes* an aggregate footprint (Secondary) does that in an
imperative effect that only used to run in reaction to a registration
event or a real `ResizeObserver` reading — neither of which fires just
because a token changed. Each of those effects now also depends on the
token(s) involved (Secondary's `recompute` re-runs directly whenever its
own identity changes for this reason), so a live edit re-measures and
re-registers rather than silently drifting out of sync until something
unrelated happens to trigger it anyway. Where a component's measurement
could plausibly be affected by a token it doesn't own directly (e.g.
`PrimaryContent`'s own gap changing a Button's rendered width), the
measuring effect depends on the whole `tokens` object rather than trying
to enumerate every indirect case — over-triggering a cheap re-measurement
is a safe trade for not chasing indirect dependencies one by one.

## Animation speed

```
duration(layer) = baseDuration * durationRatio^layer
```

Deeper layers are physically smaller on screen, so they can complete the same
perceived motion in less time — this is an optional refinement, not a
requirement; a single `baseDuration` per motion type (open/close, hover,
collapse-transition) is a valid starting point if per-layer duration scaling
turns out to be unnecessary in practice.
