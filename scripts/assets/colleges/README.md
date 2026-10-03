# College logos for the front-page "Available at" ticker

One image per **brand** (not per campus), named by its id from
`landing/src/features/newspaper/colleges.ts`; extension may be `.svg`, `.png`, `.webp` or `.jpg`.
After adding or replacing one:

```bash
node scripts/gen-college-logos.mjs
cd landing && npm run build && npm run pages:render
```

A college with no file is shown as a bare name with a small red bullet, so nothing breaks if one is
missing. `IIT` and `NIT` are families with no single mark: their files are **IIT Madras's** emblem and
**NIT Tiruchirappalli's** seal, a deliberate choice of which institute stands in front (see `SOURCES.md`).

Entries whose logo already spells the name (`srm`, `thapar`) carry `wordmark: true` in `colleges.ts`, and
the strip then omits the text label beside them.

Current ids: `iit` `nit` `srm` `vit` `bits` `mit-wpu` `thapar` `lpu` `manipal` `amrita` `amity` `kiit`
`chandigarh` `christ` `symbiosis` `dtu` `jadavpur` `du`.

Provenance and licence tags for every file are in [`SOURCES.md`](SOURCES.md). These are the registered
marks of institutions that have not agreed to be associated with ClubHub: the strip claims only that
students of each can select their college when they register.

The generator also verifies that every `names` string in `colleges.ts` exists verbatim in the sign-up
picker (`frontend/src/data/collegesIndia.ts`) and fails if one does not.
