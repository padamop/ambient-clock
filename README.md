# Art Frame

A full-screen art display for a TV web browser. It shows public-domain paintings and prints, either matted or full-bleed, and changes them slowly.

Live page: https://padamop.github.io/ambient-clock/

- Artworks close to the screen's 16:9 shape fill the screen. The rest sit in a bevel-cut mat whose color follows the painting's tones.
- A new artwork crossfades in every 10 minutes. The order is shuffled and doesn't repeat until every piece has been shown.
- A small museum label appears for 40 seconds after each change.
- The screen dims slightly from 11pm to 6am.
- New versions published here are picked up automatically (without leaving full screen).
- Press OK on the remote (or click) to go full screen. Left and right step through artworks if the browser passes the arrow keys through.

Optional URL settings, which can be combined:

| Setting | Effect |
| --- | --- |
| `?size=92` | how much of the screen height matted art may fill, 60–98 (default 86) |
| `?every=30` | minutes per artwork (default 10) |
| `?night=0` | turn off the late-night dimming |
| `?label=0` | never show the caption |

The earlier ambient clock is at [`clock.html`](https://padamop.github.io/ambient-clock/clock.html).

Images: Art Institute of Chicago open access, public domain (CC0).
