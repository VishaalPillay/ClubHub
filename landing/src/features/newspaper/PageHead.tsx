/**
 * The running head carried by pages 2–8: folio left, section centre, rubric
 * right, under a double rule. Server component.
 */
export default function PageHead({
  folio,
  section,
  rubric,
}: {
  folio: string;
  section: string;
  rubric: string;
}) {
  return (
    <header>
      <hr className="np-rule-double" />
      <div className="np-runhead">
        <span className="np-micro">{folio}</span>
        <span className="np-eyebrow">{section}</span>
        <span className="np-micro np-runhead-right">{rubric}</span>
      </div>
      <hr className="np-rule" />
    </header>
  );
}
