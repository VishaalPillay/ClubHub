# Diagrams

| File | Role |
|---|---|
| `architecture.mmd` | **Canonical.** Mermaid source for the deployment topology. Also inlined in [`../README.md`](../README.md) so it renders in place on GitHub. |
| `auth-sequence.mmd` | Refresh-token rotation + reuse detection. New — the original diagram never covered it. |
| `clubhub-aws-architecture.drawio` | Editable source of record, with AWS service icons. Higher fidelity than Mermaid, but requires a tool to view. |
| `architecture.png` | Exported raster of the `.drawio`. **Not yet generated** — see below. |

## Why both Mermaid and draw.io

They fail in opposite directions, so the set is tiered rather than duplicated:

- **Mermaid** renders natively on GitHub, diffs cleanly in review, and cannot rot — but has no
  AWS service icons, so nodes carry their identity in text (`ALB · HTTPS · ACM · /health`).
- **draw.io** has the icons and the layout work already invested, but is opaque in a diff and
  needs an export step to be visible anywhere.

Mermaid is canonical because a diagram nobody can see in a pull request stops being maintained.

## Generating `architecture.png`

This is a **one-time manual step** — `.drawio` cannot be rasterized without the draw.io CLI or a
headless Electron container, neither of which is worth adding as a build dependency for a diagram
that changes once a year.

1. Open [app.diagrams.net](https://app.diagrams.net) and load `clubhub-aws-architecture.drawio`.
2. **File → Export as → PNG…**
3. Zoom **200%**, Border width `10`, uncheck *Transparent Background*.
4. Save as `architecture.png` in this directory.

Then it can be referenced from the docs with:

```html
<img src="diagrams/architecture.png" width="900" alt="ClubHub AWS architecture">
```

Until it exists, the Mermaid rendering in [`../README.md`](../README.md) is the diagram — nothing
is broken by its absence, since no document embeds it with a hard `![]()` reference.

## Rendering the Mermaid files locally

GitHub renders ```` ```mermaid ```` fences automatically. To preview a `.mmd` file on its own,
paste it into [mermaid.live](https://mermaid.live). Both files here were validated against
Mermaid 11.
