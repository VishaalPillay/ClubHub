# Where the college logos came from

The first 16 files were downloaded on 2026-10-03 (the IIT and NIT files the same day, later) from Wikimedia (Wikimedia Commons or English Wikipedia),
which was the source specified for this task. SVGs were taken as the 600px PNG render Wikimedia itself
produces; raster files are the original uploads. `gen-college-logos.mjs` then trims each, removes a white
box around the mark where there is one, and shrinks it to at most 128px tall. Nothing is recoloured or redrawn.

**IIT and NIT are families with no single mark.** Their chips carry one institute's emblem each — **IIT
Madras** and **NIT Tiruchirappalli (Trichy)** — beside the family name. Both institutes are in the sign-up
picker, so "available at" is true for them; the logo is a choice of which institute stands in front, not a
claim that the family shares it. Swap `iit.png` / `nit.png` and re-run the generator to change the face.

| id | Wikimedia file | host | tag on that page | size |
|---|---|---|---|---|
| `iit` | [IIT Madras Logo.svg](https://en.wikipedia.org/wiki/File:IIT_Madras_Logo.svg) (IIT Madras's colour emblem) | English Wikipedia | Fair use | 300x300 |
| `nit` | [National Institute of Technology, Tiruchirappalli.svg](https://en.wikipedia.org/wiki/File:National_Institute_of_Technology,_Tiruchirappalli.svg) (NIT Trichy's seal) | English Wikipedia | Fair use | 300x300 |
| `srm` | [SRM_Institute_of_Science_and_Technology_Logo.svg](https://en.wikipedia.org/wiki/File:SRM_Institute_of_Science_and_Technology_Logo.svg) | English Wikipedia | Fair use | 544x184 |
| `vit` | [Vellore Institute of Technology seal 2017.svg](https://en.wikipedia.org/wiki/File:Vellore_Institute_of_Technology_seal_2017.svg) | English Wikipedia | Fair use | 144x152 |
| `bits` | [BITS Pilani-Logo.svg](https://en.wikipedia.org/wiki/File:BITS_Pilani-Logo.svg) | English Wikipedia | Fair use | 200x200 |
| `mit-wpu` | [MIT - WPU Logo.webp](https://commons.wikimedia.org/wiki/File:MIT_-_WPU_Logo.webp) | Commons | CC BY-SA 4.0 | 997x280 |
| `thapar` | [Thapar Logo.png](https://commons.wikimedia.org/wiki/File:Thapar_Logo.png) | Commons | Public domain | 2042x356 |
| `lpu` | [Lovely Professional University logo.png](https://en.wikipedia.org/wiki/File:Lovely_Professional_University_logo.png) | English Wikipedia | Fair use | 204x203 |
| `manipal` | [Manipal University logo.png](https://en.wikipedia.org/wiki/File:Manipal_University_logo.png) | English Wikipedia | Fair use | 293x339 |
| `amrita` | [Amrita Vishwa Vidyapeetham - Logo Icon.svg](https://en.wikipedia.org/wiki/File:Amrita_Vishwa_Vidyapeetham_-_Logo_Icon.svg) | English Wikipedia | Fair use | 316x316 |
| `amity` | [Amity University logo.png](https://en.wikipedia.org/wiki/File:Amity_University_logo.png) | English Wikipedia | Fair use | 290x343 |
| `kiit` | [KIIT logo.svg](https://en.wikipedia.org/wiki/File:KIIT_logo.svg) | English Wikipedia | Fair use | 363x276 |
| `chandigarh` | [Chandigarh University Seal.png](https://commons.wikimedia.org/wiki/File:Chandigarh_University_Seal.png) | Commons | CC BY-SA 4.0 | 265x420 |
| `christ` | [Christ University Official Logo.png](https://commons.wikimedia.org/wiki/File:Christ_University_Official_Logo.png) | Commons | CC BY-SA 4.0 | 434x454 |
| `symbiosis` | [Logo of Symbiosis International University.svg](https://en.wikipedia.org/wiki/File:Logo_of_Symbiosis_International_University.svg) | English Wikipedia | Fair use | 100x121 |
| `dtu` | [DTU, Delhi official logo.png](https://en.wikipedia.org/wiki/File:DTU,_Delhi_official_logo.png) | English Wikipedia | Fair use | 300x299 |
| `jadavpur` | [Jadavpur University Logo.svg](https://en.wikipedia.org/wiki/File:Jadavpur_University_Logo.svg) | English Wikipedia | Fair use | 316x316 |
| `du` | [Delhi University.svg](https://en.wikipedia.org/wiki/File:Delhi_University.svg) | English Wikipedia | Fair use | 326x307 |

## What the tags mean for ClubHub

- **Fair use** — these are non-free logos hosted on English Wikipedia under *Wikipedia's* fair-use rationale for
  its own articles. That rationale does not extend to other sites. The marks are the institutions' registered
  trademarks; ClubHub is using them only to name colleges whose students can select them at sign-up, and
  implies no partnership. If an institution objects, delete its file here and re-run the generator — the
  strip falls back to the bare name.
- **CC BY-SA 4.0** (`mit-wpu`, `chandigarh`, `christ`) — the uploader's licence requires attribution and
  share-alike for the *image*. The mark itself is still a trademark. If these are kept, credit the file pages
  linked above (author and licence are shown there).
- **Public domain** (`thapar`) — as tagged on Commons; the mark remains a trademark.

## Ones looked at and rejected

- `File:Iit official logo.png` — the **Italian** Institute of Technology, not the IITs.
- `File:Anna Univ edu in.png` — the logo of Anna University's Tiruchirappalli regional office, not Anna University.
- Anna University has no main logo on Wikimedia, so it is not in the strip.
- For NIT Trichy, two other files of the same seal exist (`NITT logo.png`, CC BY-SA 4.0, on a white box; and
  `NIT Trichy logo.jpg`, a different black-and-white crest). The infobox SVG was used for its clean
  transparent background.
