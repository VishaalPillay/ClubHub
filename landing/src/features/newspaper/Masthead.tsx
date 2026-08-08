import SectionRule from "./SectionRule";
import { DATELINE, EDITION_LINE, SLUGLINE } from "./edition";

/**
 * The nameplate band — page 1 only. Follows the reference broadsheet exactly:
 * thick rule, dateline left / nameplate centre / standing tagline right, a
 * second rule, then the section rule.
 *
 * Server component; only the section rule below it is interactive.
 */
export default function Masthead() {
  return (
    <header className="np-masthead">
      <hr className="np-rule" />

      <div className="np-masthead-row">
        <p className="np-micro np-masthead-side">{DATELINE}</p>
        <h1 className="np-nameplate">Club-Hub</h1>
        <p className="np-micro np-masthead-side np-masthead-side--right">{SLUGLINE}</p>
      </div>

      <div className="np-masthead-credits">
        <span className="np-micro">Edition 01</span>
        <span className="np-micro">{EDITION_LINE}</span>
      </div>

      <hr className="np-rule" />
      <SectionRule />
      <hr className="np-rule" />
    </header>
  );
}
