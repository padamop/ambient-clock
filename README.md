# Art Frame

A full-screen art display for a TV web browser. Every artwork in the collection already has roughly the TV's 16:9 shape, so each one fills the screen edge to edge with at most a few percent cropped.

Live page: https://padamop.github.io/ambient-clock/

- 74 public-domain paintings: landscapes, seascapes, harbors, city views, still lifes, and Chinese and Japanese ink paintings.
- A new artwork crossfades in every 10 minutes. The order is shuffled and doesn't repeat until every piece has been shown.
- A small museum label appears for 40 seconds after each change.
- The screen dims slightly from 11pm to 6am.
- New versions published here are picked up automatically (without leaving full screen).
- Press OK on the remote (or click) to go full screen. Left and right step through artworks if the browser passes the arrow keys through.

Optional URL settings, which can be combined:

| Setting | Effect |
| --- | --- |
| `?every=30` | minutes per artwork (default 10) |
| `?night=0` | turn off the late-night dimming |
| `?label=0` | never show the caption |

The page can still show non-16:9 art in a mat (`fit: "mat"` in `art.js`, sized with `?size=`), but the current collection doesn't use it.

The earlier ambient clock is at [`clock.html`](https://padamop.github.io/ambient-clock/clock.html).

Images: Art Institute of Chicago and Cleveland Museum of Art open access, public domain (CC0).
