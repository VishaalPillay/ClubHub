/**
 * The institutions named in the front-page "Available at" strip.
 *
 * One entry per BRAND, not per campus or branch: "IIT", not eight individual IITs; "SRM", not
 * each SRM campus. `names` lists the sign-up picker's own strings for it (from
 * `frontend/src/data/collegesIndia.ts`) — that list is the entire basis of the claim "available
 * at": a student at any of these can pick their institution when they register. Nothing here
 * says, or should be read as saying, that any institution has adopted or endorsed ClubHub.
 * `node scripts/gen-college-logos.mjs` checks every `names` string against that file and fails
 * on one that is not there — so copy names, do not type them, and do not add a college the
 * picker does not offer.
 *
 * `id` doubles as the logo file name: `scripts/assets/colleges/<id>.(png|svg|webp)` →
 * `node scripts/gen-college-logos.mjs` → `public/colleges/<id>.webp`. An entry without a logo is
 * not broken, it is set as a bare name with a red bullet.
 *
 * IIT and NIT are families with no single mark, so their chips carry ONE institute's emblem —
 * IIT Madras's and NIT Tiruchirappalli's (both are in the picker, so "available at" stays true
 * for them) — beside the family name. That is a choice about which institute stands in front, not
 * a statement that the family shares the logo; change the file in `scripts/assets/colleges/` to
 * change the face, and `SOURCES.md` records which one it is.
 */
export interface College {
  id: string;
  /** What the strip prints. */
  short: string;
  /** Picker strings this entry stands for — exact, see above. */
  names: readonly string[];
  /**
   * The logo already spells the name out (a wordmark), so the strip drops the text label that
   * would otherwise repeat it beside the mark. Ignored while the entry has no logo file —
   * a chip is never left with neither.
   */
  wordmark?: boolean;
}

export const COLLEGES: readonly College[] = [
  {
    id: "iit",
    short: "IIT",
    names: [
      "Indian Institute of Technology Madras",
      "Indian Institute of Technology Bombay",
      "Indian Institute of Technology Delhi",
      "Indian Institute of Technology Kanpur",
      "Indian Institute of Technology Kharagpur",
      "Indian Institute of Technology Roorkee",
    ],
  },
  {
    id: "nit",
    short: "NIT",
    names: [
      "National Institute of Technology Tiruchirappalli",
      "National Institute of Technology Karnataka, Surathkal",
      "National Institute of Technology Warangal",
    ],
  },
  {
    id: "srm",
    short: "SRM",
    names: ["SRM Institute of Science and Technology", "SRM University - AP"],
    wordmark: true,
  },
  {
    id: "vit",
    short: "VIT",
    names: ["Vellore Institute of Technology", "Vellore Institute of Technology - AP (VIT-AP)"],
  },
  {
    id: "bits",
    short: "BITS Pilani",
    names: [
      "Birla Institute of Technology and Science (BITS) Pilani",
      "Birla Institute of Technology and Science (BITS) Pilani, Goa Campus",
      "Birla Institute of Technology and Science (BITS) Pilani, Hyderabad Campus",
    ],
  },
  {
    id: "mit-wpu",
    short: "MIT-WPU",
    names: ["MIT World Peace University, Pune"],
    wordmark: true,
  },
  {
    id: "thapar",
    short: "Thapar",
    names: ["Thapar Institute of Engineering and Technology, Patiala"],
    wordmark: true,
  },
  { id: "lpu", short: "LPU", names: ["Lovely Professional University, Phagwara"] },
  { id: "manipal", short: "Manipal", names: ["Manipal Academy of Higher Education"] },
  {
    id: "amrita",
    short: "Amrita",
    names: ["Amrita Vishwa Vidyapeetham", "Amrita Vishwa Vidyapeetham, Amritapuri Campus"],
  },
  { id: "amity", short: "Amity", names: ["Amity University, Noida", "Amity University, Gurugram"] },
  {
    id: "kiit",
    short: "KIIT",
    names: ["Kalinga Institute of Industrial Technology, Bhubaneswar"],
  },
  {
    id: "chandigarh",
    short: "Chandigarh University",
    names: ["Chandigarh University, Gharuan"],
  },
  { id: "christ", short: "Christ", names: ["Christ University, Bengaluru"] },
  {
    id: "symbiosis",
    short: "Symbiosis",
    names: ["Symbiosis International University, Pune"],
  },
  { id: "dtu", short: "DTU", names: ["Delhi Technological University"] },
  { id: "jadavpur", short: "Jadavpur", names: ["Jadavpur University"] },
  { id: "du", short: "Delhi University", names: ["University of Delhi"] },
] as const;
