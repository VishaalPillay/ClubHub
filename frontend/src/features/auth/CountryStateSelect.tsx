"use client";

import { useMemo } from "react";
import { Country, State } from "country-state-city";

const selectClass =
  "border-2 border-black bg-white text-black p-3 font-ui text-[15px] w-full appearance-none " +
  "focus:outline-none focus:border-[#057DBC] disabled:opacity-40 rounded-none";

const labelClass = "font-mono text-[11px] uppercase tracking-widest text-[#757575]";

function Chevron() {
  return (
    <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[18px]">
      expand_more
    </span>
  );
}

/** True when the given country (display name) has states in the dataset — used by
 * the register wizard to require a state only where one exists. */
export function countryHasStates(countryName: string): boolean {
  const iso = Country.getAllCountries().find((c) => c.name === countryName)?.isoCode;
  return iso ? State.getStatesOfCountry(iso).length > 0 : false;
}

/**
 * Dependent country → state dropdowns backed by the country-state-city dataset.
 * Values are the display names (the API stores plain strings). Changing country
 * resets the state, since the old one no longer belongs to the list.
 */
export default function CountryStateSelect({
  country,
  state,
  onChange,
}: {
  country: string;
  state: string;
  onChange: (next: { country: string; state: string }) => void;
}) {
  const countries = useMemo(() => Country.getAllCountries(), []);
  const iso = useMemo(
    () => countries.find((c) => c.name === country)?.isoCode ?? null,
    [countries, country]
  );
  const states = useMemo(() => (iso ? State.getStatesOfCountry(iso) : []), [iso]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="reg-country" className={labelClass}>Country</label>
        <div className="relative">
          <select
            id="reg-country"
            value={country}
            onChange={(e) => onChange({ country: e.target.value, state: "" })}
            className={selectClass}
          >
            <option value="">Select country…</option>
            {countries.map((c) => (
              <option key={c.isoCode} value={c.name}>{c.name}</option>
            ))}
          </select>
          <Chevron />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="reg-state" className={labelClass}>State / Region</label>
        <div className="relative">
          <select
            id="reg-state"
            value={state}
            onChange={(e) => onChange({ country, state: e.target.value })}
            disabled={!country || states.length === 0}
            className={selectClass}
          >
            <option value="">
              {!country ? "Pick a country first" : states.length === 0 ? "—" : "Select state…"}
            </option>
            {states.map((s) => (
              <option key={s.isoCode} value={s.name}>{s.name}</option>
            ))}
          </select>
          <Chevron />
        </div>
      </div>
    </div>
  );
}
