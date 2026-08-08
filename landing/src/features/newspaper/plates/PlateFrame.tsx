/**
 * Shared chrome for the product-UI plates — ported from the `FragFrame` /
 * `RolePill` helpers that lived inside features/marketing/FeatureStories.tsx.
 *
 * Server components. Every plate on every page ships as zero-JS HTML.
 */

export function PlateFrame({
  head,
  meta,
  children,
}: {
  head: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="np-plate" aria-hidden="true">
      <div className="np-plate-bar">
        <span>{head}</span>
        <span>{meta}</span>
      </div>
      {children}
    </div>
  );
}

export function RolePill({ inverted, children }: { inverted?: boolean; children: string }) {
  return <span className={`np-pill${inverted ? " np-pill--on" : ""}`}>{children}</span>;
}
