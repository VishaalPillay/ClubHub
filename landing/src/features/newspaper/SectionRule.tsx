"use client";

import { useNewspaper } from "./NewspaperContext";
import { PAGES, SECTIONS } from "./edition";

/**
 * `CULTURE • CONNECTIONS • COLLABORATION • CAMPUS` — the section rule from the
 * masthead, doing real work as page-jump navigation rather than decoration.
 *
 * Rendered in two places from one component: statically under the nameplate on
 * page 1 (where it reads as authentic newspaper furniture) and inside the
 * persistent controls bar. `<button>` rather than `<a>` because these move the
 * scroll position rather than navigating — the honest element for the job.
 */
export default function SectionRule({ compact = false }: { compact?: boolean }) {
  const { index, goTo } = useNewspaper();
  const activeSection = PAGES[index]?.section;

  return (
    <nav className={`np-sections${compact ? " np-sections--compact" : ""}`} aria-label="Sections">
      {SECTIONS.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => goTo(s.page)}
          aria-current={s.key === activeSection ? "true" : undefined}
          className="np-section-link"
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}
