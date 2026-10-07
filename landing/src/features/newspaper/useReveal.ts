"use client";

import { useEffect, type RefObject } from "react";

/**
 * Reveals the plain document as it is read: headline, then copy, then the collage, then the
 * cards, then the small marks — each one a short, physical placement rather than a fade.
 *
 * ── Where this runs, and where it deliberately does not ─────────────────────
 * PLAIN MODE ONLY. In paper mode the pages are WebGL textures — photographs of this HTML — so
 * nothing on them can animate as a DOM element; the page turn is that mode's motion. And not:
 *
 *   · under `prefers-reduced-motion` — those readers are routed to plain mode precisely so that
 *     nothing moves, and nothing does;
 *   · in `pages:render` (`data-render="page"`), which photographs these articles for the 3D
 *     textures — a hidden element there would be a hole in a page texture (the CSS also
 *     refuses to hide anything under that attribute, so the two guards cover each other);
 *   · without JavaScript, for crawlers, in print: nothing is hidden until this hook has run,
 *     so the server document is always complete.
 *
 * ── Why nothing on the first screen animates ────────────────────────────────
 * The server sends every element visible. Hiding what is already on screen at hydration would
 * flash it — shown, hidden, shown again — which reads as a slow page, not a living one. So
 * anything above the fold is marked `is-in` BEFORE the scope opts in to hiding, and only what
 * the reader scrolls down to is ever placed.
 *
 * One IntersectionObserver for the whole document, and every element is unobserved the moment
 * it is placed: once a collage is down, it stays down. No scroll listener, no per-frame work.
 * The motion itself — and the very subtle parallax — is CSS, transform and opacity only.
 */

/**
 * Roles, most specific first: an element takes the first role whose selector it matches, and
 * anything INSIDE a card moves with its card rather than on its own. A plain array rather than
 * a map so the precedence is the order on the page.
 */
const ROLES: ReadonlyArray<[role: string, selector: string]> = [
  ["card", ".np-teaser, .np-p2-card, .np-voice, .np-p2-stat, .np-step, .np-box"],
  ["art", ".np-hero-art, .np-p2-art, .np-p2-plane"],
  ["head", "h2, h3, .np-eyebrow"],
  ["body", ".np-deck, .np-body, .np-quote"],
];

/** How far past the fold an element must be before it starts — the read line, not the edge. */
const ROOT_MARGIN = "0px 0px -8% 0px";

export function useReveal(scope: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const root = scope.current;
    if (!enabled || !root || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (root.hasAttribute("data-render")) return;

    const stack = root.querySelector(".np-stack");
    if (!stack) return;

    const claimed = new Set<HTMLElement>();
    const fold = window.innerHeight;

    for (const [role, selector] of ROLES) {
      for (const el of stack.querySelectorAll<HTMLElement>(selector)) {
        // Inside something already claimed (a heading inside a card) — it rides along.
        if (claimed.has(el) || [...claimed].some((c) => c.contains(el))) continue;
        // Inside a disclosure (page 8's FAQ). A closed <details> never intersects, so its
        // answer would sit hidden until opened and then fade in late; a disclosure is an
        // answer to a click and should simply be there.
        if (el.closest("details")) continue;
        claimed.add(el);
        el.setAttribute("data-rv", role);

        if (role === "card") {
          // Siblings land one after another, not as a block: their index among their own
          // row's cards becomes a small extra delay in the CSS.
          const parent = el.parentElement;
          const i = parent ? [...parent.children].indexOf(el) : 0;
          el.style.setProperty("--rv-i", String(Math.min(i, 4)));
        }

        if (el.getBoundingClientRect().top < fold) el.classList.add("is-in");
      }
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: ROOT_MARGIN, threshold: 0.12 },
    );

    for (const el of claimed) if (!el.classList.contains("is-in")) io.observe(el);

    // Opt in to the hidden starting state only now, with the first screen already placed.
    root.setAttribute("data-reveal", "on");

    const teardown = () => {
      io.disconnect();
      mo.disconnect();
      root.removeAttribute("data-reveal");
      for (const el of claimed) {
        el.classList.remove("is-in");
        el.removeAttribute("data-rv");
        el.style.removeProperty("--rv-i");
      }
    };

    /* `pages:render` does not arrive in render mode — it loads the page in plain mode like any
       visitor, lets it hydrate (so this hook has already run), and only THEN sets
       `data-render`. Checking once at mount is therefore not enough: the first version of this
       hook left the parallax running under the photographer, and Playwright timed out waiting
       for a page that would not hold still. So watch for the attribute and remove every trace
       of the reveal the instant it appears. */
    const mo = new MutationObserver(() => {
      if (root.hasAttribute("data-render")) teardown();
    });
    mo.observe(root, { attributes: true, attributeFilter: ["data-render"] });

    return teardown;
  }, [scope, enabled]);
}
