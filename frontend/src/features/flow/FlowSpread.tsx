"use client";

/**
 * The layout every step of every onboarding flow is written into.
 *
 * A step used to stack a 64px headline, then a deck, then the controls, then the
 * footer, straight down one column — which spent a third of the screen before
 * the first input and pushed "Continue" below the fold on a laptop. The page
 * scrolled to absorb it, so the sheet was a different height on every step.
 *
 * This turns that column on its side: a **rail** carrying the headline and the
 * step's place in the sequence, and a **pane** carrying the controls with the
 * footer pinned to its bottom edge. The two halves are the same on every step of
 * both flows, so the gutter rule, the headline measure and the Back/Continue
 * pair land in exactly the same place each time — which is what makes the steps
 * read as one sheet being rewritten rather than as five different pages.
 *
 * It is only meaningful inside `FlowShell fill` → `.flow-stage` →
 * `FlowSheet fill`: the whole point is that it inherits a definite height and
 * distributes it, rather than summing its children and asking the page to grow.
 * Everything structural lives in `collage.css` (`.flow-spread*`), because the
 * sizes are `vh`-relative clamps that read as arithmetic, not as utilities.
 */
export default function FlowSpread({
  eyebrow,
  title,
  lead,
  rail,
  error,
  footer,
  children,
}: {
  /** Small caps line above the headline. */
  eyebrow?: React.ReactNode;
  /** The step's headline. */
  title: React.ReactNode;
  /** The deck under the headline. */
  lead?: React.ReactNode;
  /** Pinned to the foot of the rail — `FlowIndex`, normally. */
  rail?: React.ReactNode;
  /** Shown directly above the footer, where the action that failed is. */
  error?: string;
  /** The Back / Continue pair. Laid out `justify-between`. */
  footer: React.ReactNode;
  /** The step's controls. Vertically centred in the pane. */
  children: React.ReactNode;
}) {
  return (
    <div className="flow-spread">
      <aside className="flow-spread__rail">
        <div className="min-w-0">
          {eyebrow && (
            <p className="font-mono text-[11px] uppercase tracking-[2px] text-caption-gray mb-3">
              {eyebrow}
            </p>
          )}
          <h1 className="flow-title font-display text-black">{title}</h1>
          {lead && <p className="flow-lead font-body text-caption-gray mt-4">{lead}</p>}
        </div>
        {rail}
      </aside>

      <div className="flow-spread__pane">
        <div className="flow-spread__body">
          <div className="flow-spread__inner">{children}</div>
        </div>

        {/* Above the footer rather than at the top of the sheet: the message is
            about the button an arm's length away, and putting it up by the folio
            meant a failed "Finish" reported itself off the bottom of the reader's
            attention. `flex: none` keeps it out of the scroll valve. */}
        {error && (
          <div className="shrink-0 border-2 border-error bg-[#fdf0f0] px-3 py-2 mt-4" role="alert">
            <p className="font-mono text-[11px] text-error uppercase tracking-widest">{error}</p>
          </div>
        )}

        <div className="flow-spread__foot">{footer}</div>
      </div>
    </div>
  );
}

/**
 * The sequence, marked at the current step. Sits at the foot of the rail.
 *
 * Explicitly not a progress bar — the four faked ones (each filling itself with
 * a `setTimeout` after mount) are what `Folio` replaced. Nothing here fills and
 * nothing runs on a timer: the current line is simply set in black with a longer
 * rule beside it. The folio says which step you are on; this says what the
 * sequence is, which is the one thing movement between steps cannot show you.
 */
export function FlowIndex({
  labels,
  current,
}: {
  labels: readonly string[];
  /** 1-based. */
  current: number;
}) {
  return (
    <ol className="flow-index">
      {labels.map((label, i) => {
        const n = i + 1;
        const state = n === current ? "current" : n < current ? "done" : "todo";
        return (
          <li
            key={label}
            className={`flow-index__item flow-index__item--${state}`}
            aria-current={n === current ? "step" : undefined}
          >
            <span className="flow-index__rule" aria-hidden />
            <span className="truncate">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
