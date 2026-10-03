"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { collegesFor } from "@/data/collegesIndia";
import { getColleges, requestCollege, type CollegeOut } from "@/lib/api/colleges";

// The register/create-club wizards pin their step to one non-scrolling viewport
// (FlowShell `fill`, 100dvh + overflow-hidden — see CLAUDE.md), so a menu positioned
// `absolute` off an ancestor gets clipped at that boundary with no scroll to reach it.
// Portaling to <body> and positioning `fixed` from the input's own measured rect escapes
// that clipping (and any transformed ancestor from the step's slide animation) entirely.
const MENU_MARGIN = 12;
const MENU_MIN_HEIGHT = 160;
const MENU_MAX_HEIGHT = 288; // matches the old max-h-72

type MenuStyle = { left: number; width: number; maxHeight: number; top?: number; bottom?: number };

const DEFAULT_LABEL_CLASS = "font-mono text-[11px] uppercase tracking-widest text-[#757575]";
const DEFAULT_INPUT_CLASS =
  "border-2 border-black bg-paper text-black p-3 font-ui text-[15px] w-full rounded-none " +
  "focus:outline-none focus:border-[#057DBC]";

/** Curated list + anything since auto-promoted from requestCollege (app/scripts/
 * promote_college_requests.py on the backend) — dedupe case-insensitively, curated order
 * first (it's NIRF-ranked, not alphabetical), promoted extras appended after. */
function mergeOptions(curated: string[] | null, promoted: CollegeOut[]): string[] | null {
  if (!curated && promoted.length === 0) return null;
  const seen = new Set((curated ?? []).map((name) => name.toLowerCase()));
  const extra = promoted.filter((c) => !seen.has(c.name.toLowerCase())).map((c) => c.name);
  return [...(curated ?? []), ...extra];
}

/**
 * College picker: once there's a curated and/or promoted list for this country/state, this
 * renders a searchable combobox (type-to-filter + a persistent "Can't find your college?"
 * row). Everywhere else — non-India with nothing promoted yet, an un-curated state, or no
 * state chosen yet — it's the plain free-text input it always was, so nothing is ever
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
  const curated = collegesFor(country, state);
  // Silent fallback by construction: on fetch failure `data` just stays [], so `options`
  // degrades to curated-only (or the free-text input below, if there's no curated list either).
  const { data: promoted = [] } = useQuery({
    queryKey: ["colleges", country, state],
    queryFn: () => getColleges(country, state || null),
    enabled: !!country,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const options = mergeOptions(curated, promoted);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const requestNameId = useId();
  const listboxId = useId();

  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [menuStyle, setMenuStyle] = useState<MenuStyle | null>(null);

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
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inContainer && !inDropdown) {
        setOpen(false);
        setShowRequest(false);
        const trimmed = query.trim();
        if (trimmed && trimmed !== value) onChange(trimmed);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, query, value, onChange]);

  // Recompute where the (portaled) menu should sit — below the input, or flipped
  // above it when there isn't room below (e.g. a taskbar or short viewport eating
  // the bottom of the screen) — whenever it opens, and keep it pinned on resize/scroll.
  const updateMenuPosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_MARGIN;
    const spaceAbove = rect.top - MENU_MARGIN;
    const openBelow = spaceBelow >= MENU_MIN_HEIGHT || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(120, Math.min(MENU_MAX_HEIGHT, openBelow ? spaceBelow : spaceAbove));
    setMenuStyle({
      left: rect.left,
      width: rect.width,
      maxHeight,
      ...(openBelow
        ? { top: rect.bottom + 4 }
        : { bottom: window.innerHeight - rect.top + 4 }),
    });
  }, []);

  useLayoutEffect(() => {
    // No cleanup needed for the closed case: the portal render below is gated on
    // `open` too, so a stale menuStyle just sits unused until the next open.
    if (!open) return;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

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
        ref={inputRef}
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

      {open &&
        menuStyle &&
        createPortal(
          <div
            ref={dropdownRef}
            id={listboxId}
            style={{
              position: "fixed",
              left: menuStyle.left,
              width: menuStyle.width,
              maxHeight: menuStyle.maxHeight,
              top: menuStyle.top,
              bottom: menuStyle.bottom,
            }}
            className="z-50 border-2 border-black bg-paper overflow-y-auto shadow-[4px_4px_0_0_rgba(0,0,0,0.15)]"
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
                  className="border-2 border-black bg-paper text-black p-2 font-ui text-[14px] rounded-none focus:outline-none focus:border-[#057DBC]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitRequest}
                    disabled={!requestName.trim()}
                    className="flex-1 font-ui text-[12px] font-bold border-2 border-[#057DBC] bg-[#057DBC] text-paper px-3 py-2 uppercase hover:bg-paper hover:text-[#057DBC] transition-colors disabled:opacity-40"
                  >
                    Request &amp; use this name
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRequest(false)}
                    className="font-ui text-[12px] font-bold border-2 border-black px-3 py-2 uppercase hover:bg-black hover:text-paper transition-colors"
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
                          className="w-full text-left px-4 py-2.5 font-ui text-[14px] hover:bg-[#eee0cb] transition-colors border-b border-[#e0d0b6]"
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
          </div>,
          document.body
        )}
    </div>
  );
}
