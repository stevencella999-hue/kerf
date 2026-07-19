/**
 * materials.js
 * Per-material tone tuning for laser engraving.
 *
 * These are *starting-point* heuristics, not a physical simulation of any
 * real laser or material batch. Every material burns/marks differently
 * depending on power, speed, lens, and even the tree the wood came from —
 * always run a test tile before committing to a full engrave.
 *
 * Fields:
 *  brightness  -1..1   shifts the whole tone curve up/down
 *  contrast    -1..1   steepens/flattens the curve around midpoint
 *  gamma        >0     midtone bias (1 = linear, <1 lightens mids, >1 darkens mids)
 *  invert       bool   true when the laser REMOVES a dark coating to reveal a
 *                       light substrate (so a "dark" pixel in the source photo
 *                       needs to become a LOW-power / unmarked pixel, not high)
 *  ditherBias  -1..1   nudges the dither threshold to favor more/less burn
 *  label        string swatch color hint used only for the on-screen chip
 */
const MATERIALS = {
  wood: {
    name: "Wood",
    brightness: 0.03,
    contrast: 0.22,
    gamma: 1.15,
    invert: false,
    ditherBias: 0.05,
    swatch: "linear-gradient(135deg, #c8925a 0%, #a9713a 45%, #8a5a2c 100%)",
    note: "Warm burn tones. Slight contrast boost keeps grain from muddying midtones.",
  },
  slate: {
    name: "Black Slate",
    brightness: 0,
    contrast: 0.3,
    gamma: 1.0,
    invert: true,
    ditherBias: -0.1,
    swatch: "linear-gradient(135deg, #4a4d52 0%, #2b2d30 60%, #131416 100%)",
    note: "Laser removes a dark coating to expose the light stone beneath — image is inverted.",
  },
  acrylic: {
    name: "Acrylic",
    brightness: 0.05,
    contrast: 0.1,
    gamma: 1.0,
    invert: false,
    ditherBias: 0,
    swatch: "linear-gradient(135deg, #eaf6f8 0%, #cfeef2 50%, #a9dee4 100%)",
    note: "Frosting effect is gentle; low contrast avoids blown-out highlights.",
  },
  leather: {
    name: "Leather",
    brightness: -0.05,
    contrast: 0.18,
    gamma: 1.2,
    invert: false,
    ditherBias: 0.08,
    swatch: "linear-gradient(135deg, #8a5a3c 0%, #6e4429 55%, #4d2e1b 100%)",
    note: "Darkens mids so scorch marks don't wash out on lighter hides.",
  },
  cork: {
    name: "Cork",
    brightness: 0.02,
    contrast: 0.35,
    gamma: 1.05,
    invert: false,
    ditherBias: 0.1,
    swatch: "linear-gradient(135deg, #d9b48f 0%, #c19a6b 55%, #a97d4e 100%)",
    note: "Cork's natural texture is busy — extra contrast keeps the image from disappearing into it.",
  },
  glass: {
    name: "Glass",
    brightness: 0.08,
    contrast: 0.28,
    gamma: 0.95,
    invert: true,
    ditherBias: -0.05,
    swatch: "linear-gradient(135deg, #eef6f8 0%, #d7ecf0 55%, #b9dbe2 100%)",
    note: "Frosted marks read as white-on-clear, so the source tones are inverted.",
  },
  aluminum: {
    name: "Anodized Aluminum",
    brightness: -0.02,
    contrast: 0.32,
    gamma: 1.0,
    invert: true,
    ditherBias: -0.08,
    swatch: "linear-gradient(135deg, #2c2f33 0%, #1a1c1f 60%, #0d0e10 100%)",
    note: "Laser burns through the anodized layer to bright bare metal — inverted for a clean mark.",
  },
  steel: {
    name: "Stainless Steel",
    brightness: 0,
    contrast: 0.4,
    gamma: 0.9,
    invert: false,
    ditherBias: -0.05,
    swatch: "linear-gradient(135deg, #cfd3d6 0%, #aeb3b8 50%, #83898f 100%)",
    note: "Annealing marking needs punchy contrast — steel doesn't hold soft gradients well.",
  },
  tile: {
    name: "White Tile",
    brightness: 0.05,
    contrast: 0.3,
    gamma: 1.0,
    invert: false,
    ditherBias: 0,
    swatch: "linear-gradient(135deg, #fbfbf9 0%, #f0efe9 55%, #e2e0d6 100%)",
    note: "High contrast so marks read clearly through the glaze.",
  },
  tileBlack: {
    name: "White Tile (painted black)",
    brightness: 0,
    contrast: 0.3,
    gamma: 1.0,
    invert: true,
    ditherBias: -0.1,
    swatch: "linear-gradient(135deg, #26282b 0%, #17181a 55%, #0a0a0b 100%)",
    note: "Laser removes black paint to reveal white tile beneath — image is inverted.",
  },
};

const MATERIAL_ORDER = [
  "wood", "slate", "acrylic", "leather", "cork",
  "glass", "aluminum", "steel", "tile", "tileBlack",
];
