import CollegeStrip from "./CollegeStrip";
import Wordmark from "./Wordmark";
import { MASTHEAD_STRIP } from "./edition";

/**
 * The nameplate band — page 1 only: a thin furniture strip (founding year, paper name,
 * edition), the wordmark on its own, then the "Available at"
 * ticker of institutions between two rules. (The section links that used to sit there
 * are still one scroll away in the fixed bar along the bottom of the screen.)
 *
 * Server component.
 */
export default function Masthead() {
  return (
    <header className="np-masthead">
      <div className="np-topstrip">
        {MASTHEAD_STRIP.map((t) => (
          <span key={t} className="np-micro">
            {t}
          </span>
        ))}
      </div>

      <div className="np-masthead-row">
        <h1 className="np-nameplate">
          <Wordmark sizes="570px" priority />
        </h1>
      </div>

      <hr className="np-rule" />
      <CollegeStrip />
      <hr className="np-rule" />
    </header>
  );
}
