"use client";

import { useEffect, useId, useRef, useState } from "react";
import { collegesFor } from "@/data/collegesIndia";
import { requestCollege } from "@/lib/api/colleges";

const DEFAULT_LABEL_CLASS = "font-mono text-[11px] uppercase tracking-widest text-[#757575]";
const DEFAULT_INPUT_CLASS =
  "border-2 border-black bg-white text-black p-3 font-ui text-[15px] w-full rounded-none " +
  "focus:outline-none focus:border-[#057DBC]";

/**
 * College picker: once `collegesFor(country, state)` has a curated list, this
 * renders a searchable combobox (type-to-filter + a persistent "Can't find your
 * college?" row). Everywhere else — non-India, an un-curated state, or no state
 * chosen yet — it's the plain free-text input it always was, so nothing is ever
 * blocked on the curated list being incomplete.
 */
export default function CollegeSelect({
  country,
  state,
  value,
  onChange,
  disabled,
  id = "college-select-input",
  label = "Current College",
  labelClassName = DEFAULT_LABEL_CLASS,
  inputClassName = DEFAULT_INPUT_CLASS,
}: {
  country: string;
  state: string;
  value: string;
  onChange: (institution: string) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  labelClassName?: string;
  inputClassName?: string;
}) {
  const options = collegesFor(country, state);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestNameId = useId();
  const listboxId = useId();

  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [requestName, setRequestName] = useState("");

  // Adjust state during render (React's recommended alternative to an effect
  // for this exact case) rather than useEffect, which would cost an extra
  // commit and trip the set-state-in-effect lint rule.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    // Reflect external prefill/resume without fighting active typing.
    setPrevValue(value);
    setQuery(value);
  }

  const [prevLocation, setPrevLocation] = useState({ country, state });
  if (country !== prevLocation.country || state !== prevLocation.state) {
    // Reset only internal UI on a location change — never clear the parent
    // value, which would wipe a resumed registration's prefilled institution.
    setPrevLocation({ country, state });
    setOpen(false);
    setShowRequest(false);
  }

  // Close on outside interaction, and commit any freely-typed text that was
  // never explicitly selected/requested — this also covers "typed a college,
  // then clicked Continue" since that click's mousedown lands outside this
  // container and fires before the Continue button's own click handler.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowRequest(false);
        const trimmed = query.trim();
        if (trimmed && trimmed !== value) onChange(trimmed);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, query, value, onChange]);

  if (!options) {
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className={labelClassName}>
          {label}
        </label>
        <input
          id={id}
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your college / university"
          className={inputClassName}
        />
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const matches = q ? options.filter((opt) => opt.toLowerCase().includes(q)) : options;

  const selectOption = (opt: string) => {
    onChange(opt);
    setQuery(opt);
    setOpen(false);
    setShowRequest(false);
  };

  const submitRequest = () => {
    const name = requestName.trim();
    if (!name) return;
    // Fire-and-forget — logging the request must never block the user from proceeding.
    requestCollege({ name, country, state: state || null }).catch(() => {});
    onChange(name);
    setQuery(name);
    setShowRequest(false);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-2 relative" ref={containerRef}>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listboxId}
        autoComplete="off"
        disabled={disabled}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setShowRequest(false);
          }
        }}
        placeholder="Search for your college…"
        className={inputClassName}
      />

      {open && (
        <div
          id={listboxId}
          className="absolute top-full left-0 right-0 mt-1 z-20 border-2 border-black bg-white max-h-72 overflow-y-auto shadow-[4px_4px_0_0_rgba(0,0,0,0.15)]"
        >
          {showRequest ? (
            <div className="p-4 flex flex-col gap-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#757575]">
                Tell us your college
              </p>
              <input
                id={requestNameId}
                type="text"
                value={requestName}
                onChange={(e) => setRequestName(e.target.value)}
                placeholder="College name"
                className="border-2 border-black bg-white text-black p-2 font-ui text-[14px] rounded-none focus:outline-none focus:border-[#057DBC]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={submitRequest}
                  disabled={!requestName.trim()}
                  className="flex-1 font-ui text-[12px] font-bold border-2 border-[#057DBC] bg-[#057DBC] text-white px-3 py-2 uppercase hover:bg-white hover:text-[#057DBC] transition-colors disabled:opacity-40"
                >
                  Request &amp; use this name
                </button>
                <button
                  type="button"
                  onClick={() => setShowRequest(false)}
                  className="font-ui text-[12px] font-bold border-2 border-black px-3 py-2 uppercase hover:bg-black hover:text-white transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            <>
              {matches.length > 0 ? (
                <ul>
                  {matches.map((opt) => (
                    <li key={opt}>
                      <button
                        type="button"
                        onClick={() => selectOption(opt)}
                        className="w-full text-left px-4 py-2.5 font-ui text-[14px] hover:bg-[#f3f3f3] transition-colors border-b border-[#e2e8f0]"
                      >
                        {opt}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 font-ui text-[13px] text-[#757575]">
                  No matches — try a different search.
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setRequestName(query.trim());
                  setShowRequest(true);
                }}
                className="w-full text-left px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-[#057DBC] hover:bg-[#f0f8ff] transition-colors"
              >
                Can&apos;t find your college?
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
