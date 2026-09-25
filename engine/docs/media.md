# Media: video, SVG and picture sizes

Since 2.17. A site that updates and changes nothing renders exactly what it
did before; each of these is switched on where it is wanted.

## Video that plays on phones

The media route answers byte-range requests (`206 Partial Content`), which
iOS Safari needs before it will play an MP4 at all. It also sends `ETag` and
`Last-Modified`, answers `304 Not Modified`, and honours `If-Range`. Nothing
to configure. To serve `/media` from nginx instead, see INSTALL.md §8.

## Moving pictures — the video block's *ambient* display

**Video block → Plays → As a moving picture.** An uploaded film plays muted
and looped, with no player chrome, like an animated picture:

- It plays only while at least a quarter of it is on screen, and pauses when
  it scrolls away.
- A visitor who asked for less motion (their system setting, or the site's
  own switch) sees the poster and a play button; pressing it plays the film.
- **Shape → The film's own shape** reserves exactly the right box before the
  file loads, from the width and height read when it was uploaded — so the
  page does not jump. The other shapes crop to 16:9, 4:3, square, 21:9 or
  upright 9:16.
- **The same film in another format**: add a WebM beside an MP4 (or the other
  way round); browsers try the WebM first, which is usually smaller.
- Fit (fill and crop, or whole with bars), width, rounded corners, and a
  pause button over the film (on by default).

A YouTube or Vimeo link cannot loop silently, so with one of those the block
shows its ordinary player.

**Gallery tiles** can be films too: *Video instead* on a picture makes the
tile a moving picture with the picture as its poster, and the full-screen
viewer plays it with controls. **Carousel slides** with a video follow the
same on-screen rule.

Uploading an MP4 or WebM records its width, height and length (Media shows
them). No ffprobe is needed on the server.

## A film behind any section

**Design → Background → Video**, on any block or row: an MP4 or WebM from
the library, laid under the overlay colour and the content. Optionally a
lighter file for phones, a poster, and *On phones: show the poster only*.
Visitors with data saver on, or who asked for less motion, get the poster.
The phone never downloads the desktop file — the choice is made in the
browser.

## SVG

SVG files can be uploaded like any picture: logos, icons, cards, the header
logo, the favicon. An SVG is a small document, so each upload is rebuilt from
an allowlist — shapes, text, gradients, filters, masks, styles — and loses
scripts, event handlers, `foreignObject`, links to anywhere outside the file,
and anything in its CSS that fetches something. It is served with a policy
that runs nothing. Up to 1 MB.

**Security → SVG uploads** chooses who may upload one: administrators and
managers to begin with.

## Picture sizes (responsive images)

**Media → Picture sizes → Responsive images.** When on:

- Each picture gets smaller copies — 480, 768, 1024, 1440, 1920 and 2560
  pixels wide, never wider than the original — as WebP, and as AVIF too if
  you tick it. New uploads get them straight away; **Make the missing sizes**
  does the pictures already in the library, in the background, with
  progress on the screen.
- Every image on the site offers those sizes (`srcset`) with a `sizes` that
  matches where it sits — a card, a logo, a full-width hero — so a phone
  downloads a phone-sized picture. Images below the fold load lazily; the
  first hero is fetched first.
- GIFs keep their animation, and SVGs need no sizes.

A size is asked for as `?w=768` on the picture's own address; the site
answers with the smallest copy at least that wide — AVIF to browsers that
take it — or the original while copies do not exist yet. Switching it off
returns every page to plain `<img>` tags; the copies stay on disk until the
pictures are deleted.
