// ─── BOM (Bill of Materials) Configuration ──────────────────────────────────
// Central source of truth for material requirements per product.
// All base values assume size M (factor = 1.00).

export const BOM_PRODUCTS = [
  {
    name: "Basketball Jersey",
    fabric: 0.9,
    ink: 15,
    thread: 135,
    paper: 0.9
  },
  {
    name: "Basketball Jersey Shorts",
    fabric: 0.7,
    ink: 10,
    thread: 115,
    paper: 0.7
  },
  {
    name: "Basketball Jersey Set Regular Cut",
    fabric: 1.6,
    ink: 25,
    thread: 250,
    paper: 1.6
  },
  {
    name: "Basketball Jersey Nike Elite Cut",
    fabric: 1.1,
    ink: 18,
    thread: 165,
    paper: 1.1
  },
  {
    name: "Basketball Jersey Nike Elite Cut Shorts",
    fabric: 0.8,
    ink: 12,
    thread: 135,
    paper: 0.8
  },
  {
    name: "Basketball Jersey Set Nike Elite Cut",
    fabric: 1.9,
    ink: 30,
    thread: 300,
    paper: 1.9
  },
  {
    name: "Volleyball Jersey",
    fabric: 0.8,
    ink: 13,
    thread: 125,
    paper: 0.8
  },
  {
    name: "Volleyball Jersey Shorts",
    fabric: 0.6,
    ink: 8,
    thread: 105,
    paper: 0.6
  },
  {
    name: "Volleyball Jersey Set",
    fabric: 1.4,
    ink: 20,
    thread: 230,
    paper: 1.4
  },
  {
    name: "Jersey Regular + NBA Cut",
    fabric: 1.1,
    ink: 18,
    thread: 155,
    paper: 1.1
  },
  {
    name: "Football Jersey (Dual Fabric)",
    fabric: 1.35,
    ink: 23,
    thread: 200,
    paper: 1.35
  },
  {
    name: "Football Jersey (Single Fabric)",
    fabric: 1.15,
    ink: 20,
    thread: 175,
    paper: 1.15
  },
  {
    name: "Hockey Jersey (Single Mesh Fabric)",
    fabric: 1.45,
    ink: 25,
    thread: 225,
    paper: 1.45
  },
  {
    name: "Hockey Jersey (Dual Fabric)",
    fabric: 1.8,
    ink: 32,
    thread: 285,
    paper: 1.8
  },
  {
    name: "Reversible Jersey (Lightweight)",
    fabric: 1.8,
    ink: 30,
    thread: 250,
    paper: 1.8
  },
  {
    name: "Reversible Jersey (Lightweight Mesh)",
    fabric: 2.0,
    ink: 34,
    thread: 285,
    paper: 2.0
  },
  {
    name: "T-Shirt Jersey",
    fabric: 1.05,
    ink: 16,
    thread: 150,
    paper: 1.05
  },
  {
    name: "Longsleeve",
    fabric: 1.35,
    ink: 22,
    thread: 195,
    paper: 1.35
  },
  {
    name: "Longsleeve Hoodie",
    fabric: 2.05,
    ink: 32,
    thread: 285,
    paper: 2.05
  },
  {
    name: "Poloshirt Knitted Collar",
    fabric: 1.35,
    ink: 23,
    thread: 205,
    paper: 1.35
  },
  {
    name: "Poloshirt Neoprane Collar",
    fabric: 1.35,
    ink: 23,
    thread: 205,
    paper: 1.35
  },
  {
    name: "Chinese Collar",
    fabric: 1.25,
    ink: 20,
    thread: 195,
    paper: 1.25
  },
  {
    name: "Chinese Collar Longsleeve",
    fabric: 1.6,
    ink: 27,
    thread: 250,
    paper: 1.6
  }
]

// ─── Size Factors ───────────────────────────────────────────────────────────
// Multiplied against base material values.  M = 1.00 (baseline).
export const SIZE_FACTORS = {
  "XS":  0.85,
  "S":   0.90,
  "M":   1.00,
  "L":   1.10,
  "XL":  1.20,
  "2XL": 1.30,
  "3XL": 1.45
}

// ─── Add-Ons (flat additions AFTER size scaling) ────────────────────────────
export const BOM_ADDONS = {
  "Short Pocket": {
    fabric: 0.1,
    ink: 0,
    thread: 10,
    paper: 0.1
  },
  "Full Zip Hoodie": {
    fabric: 0.2,
    ink: 0,
    thread: 40,
    paper: 0.2
  },
  "Special Collar": {
    fabric: 0.05,
    ink: 0,
    thread: 15,
    paper: 0.05
  },
  "4XL": {
    fabric: 0.5,
    ink: 0,
    thread: 15,
    paper: 0.05
  }
}
