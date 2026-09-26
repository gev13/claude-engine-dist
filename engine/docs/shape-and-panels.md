# Corners, panels and the notch header

Since 2.21. Every option starts at what the site already did.

## Corners — Appearance → Shape

Each kind of element can keep its rounded corners or have them **cut on the
diagonal**: cards, buttons, form fields, chips (form choices, blog
categories, project filters) and pictures. Choose the length of the cut and
which corners — top right and bottom left unless you tick others.

- A cut **card** clips its own picture too.
- A cut **button** keeps its glow; its border follows the cut.
- A cut **chip** or **field** keeps a thin line along the cut.
- A **picture** takes the shape when its image block is set to *Cut corners*.

One section's corners, and one card's, are set in its Design tab and its
card style.

## Panels — Appearance → Shape → Panels

Tick **Panel** in a section's Design tab and it sits on the page as a panel:
inset from the edges, in the panel colour, with the panel corners. Set the
inset, the space between panels, the colour and the corners once, here. The
page around the panels is the page colour (Colours → Background). On a phone
the inset shrinks by itself.

**Clip pictures and films inside to the rounded corners** (Design tab) does
what it says for a section with a radius.

## The notch header — Appearance → Header & menus

The **Notch** layout puts the logo and links in a tab cut into the top-left
of the first section, the page colour showing through, with curved inner
corners. Make the first section a **Panel**. The curve and the tab's colour
are yours to set. It does not stick while scrolling.

**Header links** — font, size, weight, case, letter spacing, the space
between them, and their colour and the current page's colour.

## Buttons — Appearance → Buttons

- **Button font** — any face in the catalogue.
- **The arrow** — beside the label, or in a compartment of its own behind a
  thin divider.
- **Glow** round the main button — its size and colour.

## Section labels — Appearance → Typography

The small line opening a section can have a **short line** (as before), a
**dot**, or nothing in front of it, in any colour.

## Media band

**A colour fading in from one side** — solid up to one point, clear from
another, with the picture showing on the other side. The text and buttons
turn dark for a light colour.

## Fonts

Chakra Petch joins the catalogue, and a section's own typography can use any
catalogue face.

## Sections added in 2.22

- **Picture rows** — a Card grid layout: a large picture on the left, a
  running number (01, 02…), the title, text and a *Read more* link. For a
  list of services.
- **Rows of mixed widths** — a Card grid can hold its cards in rows of
  different counts: `2-3` is two, then three, then two… Leave it empty for
  the even grid. Cards can carry a running number too.
- **Stats** — the numbers can glow in the accent colour, and thin lines can
  stand between the figures, which then sit to the left.
- **Check lists** — the marker on a tinted circle, hairline rules between
  rows, and each list in a card.
- **Forms** — a short line beside the send button: *We reply within one
  working day*.
- **Category index** — a new block: the blog's categories, or the
  projects', as numbered cards with their descriptions, each linking to its
  archive. Read from the site, so a new category appears on its own.
- **Blog** (Appearance → Blog) — the search box at the end of the category
  bar, and the newest post as a large card (picture left) above the list.
- **“Read more” links** (Appearance → Buttons) — the arrow on a small
  circle, everywhere a card, a post or a row links on.
- **Hero kicker** — the small line above the eyebrow (“Services / 02”) on
  every hero layout, not only the classic one.

## Added in 3.1

- **The footer's logo** (Appearance → Footer) — the built-in mark and the
  site name (as before), the logo uploaded in Brand at a height you choose,
  or nothing.
- **The footer as a panel** (same place) — inset, in the panel colour and
  corners, like a section marked Panel.
- **A split hero to the edges** — tick *Run the picture to the section’s
  edges* on a Split hero: the picture fills its side from the top to the
  bottom and out to the edge, behind the text's side, at the height you
  choose. On a phone it goes back above the text.
- **An arrow per button** — the hero, the call to action, the media band,
  split media and quotes each let a button carry the arrow (in its own
  compartment when Appearance → Buttons says so), or not. Unset is what the
  block always drew.
- **Lines between sections** (Appearance → Layout) — untick *A thin line
  under each section and above the footer* for a page of panels.
- **Section heading width** (same place) — how far a section's heading runs
  before it wraps, e.g. `820px`. Empty keeps each block's own.

## Added in 3.2

- **Form fields** (Appearance → Colours) — the fill, edge and text of
  every text field, and of each choice chip until it is chosen.
- **A form the full width of its section** — tick *Run the form the full
  width of the section* on a Form block.
- **Covers on the plain post cards** — a Post list in the Cards layout can
  show each post's cover above its title, at the shape you choose.

## Added in 3.3

- **Heading and text sizes on tablets and phones** — a section's own
  typography (Design tab) takes a size for tablets and one for phones, so a
  large desktop heading is not large on a phone.
- **The contained FAQ follows cut corners** when cards are cut.
- **Line up a panel's content** (Appearance → Shape → Panels) with the
  content of the sections outside panels, at every width — for a
  full-width site of panels.
- **The blog's category bar on category pages** (Appearance → Blog), with
  the page's own chip lit, and the search on its own labelled row under the
  chips if you like.
- **A split hero run to the edges reaches up behind the notch header**, so
  the picture fills the space beside the header tab.

## Added in 3.3.2

- **Picture width** on a split hero run to the edges — how much of the
  section the picture takes, in percent (72 when empty). The text beside it
  widens to match, never narrower than half the row.

## Added in 3.3.3

- **The picture** on a split hero run to the edges — *Fills its box* (as
  before) or *Whole, at full height, against the edge*, which keeps a
  square picture square at every screen width.
- **Least height** for that hero, e.g. `640px`.
- The text beside it now stops at a reading width (40rem), so a heading
  keeps its lines on a wide screen.
