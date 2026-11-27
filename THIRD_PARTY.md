# Third-party material

- **Newstroke font** (`fonts/newstroke.woff2`, embedded in `fontdata.js`): the font KiCad uses for schematic text.
  This web-font conversion came from onlinewebfonts.com, whose page says: "Fonts made from Web Fonts
  (http://www.onlinewebfonts.com) is licensed by CC BY 4.0". The font file's own metadata reads
  "Copyright (c) 2024, zeankun.dev. font belongs to kicad (https://kicad.org)". Credit: onlinewebfonts.com, KiCad.
  Origin: KiCad's Newstroke glyph data. KiCad's source header (`newstroke_font.h`) carries an MIT-style licence
  (free to use, copy, modify, distribute and sell if the notice is kept, no warranty); it does not name an author.
  The onlinewebfonts page leaves its own licence field blank. If you want to be certain, replace the font with a
  conversion taken directly from KiCad's source.
  The original KiCad licence for this font has not been independently verified; if that matters for your use,
  check KiCad's own repository, or switch back to the bundled Hershey font (`App.USE_HERSHEY = true`).
- **Hershey fonts** (`hershey.js`, off by default): Dr. A. V. Hershey, U.S. National Bureau of Standards; data format by
  James Hurt, Cognition, Inc.; via the MIT-licensed "hersheytext" package.
- **KiCad symbol libraries** (`lib/`): see `lib/LICENSE-KiCad-libraries.md`.

- **Footprint names** (`fplib.js`): the list of footprint library and footprint names from KiCad's official footprint libraries (github.com/KiCad/kicad-footprints, CC-BY-SA 4.0 with KiCad's library exception). Only names are included, not geometry.
