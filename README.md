# Art Frame

A full-screen art display for a TV web browser. Every artwork in the collection already has roughly the TV's 16:9 shape. Each one fills the screen inside an even mat with a beveled edge, with at most a few percent cropped.

Live page: https://padamop.github.io/ambient-clock/

- 74 public-domain paintings: landscapes, seascapes, harbors, city views, still lifes, and Chinese and Japanese ink paintings.
- A new artwork crossfades in every 10 minutes. The order is shuffled and doesn't repeat until every piece has been shown.
- A small museum label appears for 40 seconds after each change.
- The screen dims slightly from 11pm to 6am.
- New versions published here are picked up automatically (without leaving full screen).
- Press OK on the remote (or click) to go full screen. In full screen, OK shows the border picker and pressing OK again steps through 0, 2, 4, 6, 8, 10 and 12 (the TV remembers the choice). Left and right step through artworks, and up and down change the border, if the browser passes the arrow keys through.

Optional URL settings, which can be combined:

| Setting | Effect |
| --- | --- |
| `?border=6` | mat width on each side, as % of screen height (default 8; `0` = edge to edge); overrides the remote setting |
| `?every=30` | minutes per artwork (default 10) |
| `?night=0` | turn off the late-night dimming |
| `?label=0` | never show the caption |

The page can still show non-16:9 art in a mat (`fit: "mat"` in `art.js`, sized with `?size=`), but the current collection doesn't use it.

The earlier ambient clock is at [`clock.html`](https://padamop.github.io/ambient-clock/clock.html).

Images: Art Institute of Chicago and Cleveland Museum of Art open access, public domain (CC0).
