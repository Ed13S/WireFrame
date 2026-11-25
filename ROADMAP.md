# WireFrame roadmap (ideas, not promises)

Goal: students draw and simulate a schematic here, then hand it to KiCad for the PCB.

- Done: `.kicad_sch` export and import (symbols, wires, labels, no-connects, title block).
- Done: per-part **Footprint** field, written into the exported `.kicad_sch`.
- Next: pick footprints from a short list per part (resistor, cap, LED, DIP, headers).
- Next: export a KiCad **netlist** (`.net`) with footprints so KiCad's PCB editor can import it directly.
- Later: a "Share" page where students publish schematics (needs a hosted back end).
