import { MIN_WIDTH, READING_MODE_KEY } from "./readingMode";
import { resolvedPhaseForHour } from "../scene/timeOfDay";

/**
 * The blocking script that decides how the page looks BEFORE first paint.
 *
 * ── The problem it exists to solve ───────────────────────────────────────────
 * Reading mode is decided on the client, from things the server cannot know:
 * reduced-motion, viewport width, whether WebGL works. `useSyncExternalStore`
 * handles that correctly — but "correctly" means the decision lands at
 * HYDRATION, and the server document is the plain eight-page newspaper. So a
 * desktop visitor got a full-screen cream broadsheet for as long as the bundle
 * took to arrive and hydrate — measured at 1.6 seconds — before it vanished and
 * was replaced by a dark room. That is not a slow load, it is the wrong page.
 *
 * A blocking inline script is the standard fix, and it is the only one: nothing
 * that runs after the bundle can prevent something the browser has already
 * painted. This runs in the head, decides the same thing `getReadingMode` will
 * decide later, and writes it onto <html> where CSS can act on it immediately.
 *
 * ── What it does beyond that ────────────────────────────────────────────────
 * Having made the decision, it is also the earliest possible moment to start the
 * downloads that decision implies — the room's poster and the first leaf's two
 * page textures. Those were previously requested only after the scene chunk had
 * arrived, which is why the paper turned up two seconds after the room did.
 *
 * **The page textures must be preloaded `crossOrigin="anonymous"`; the poster
 * must not.** three's TextureLoader defaults to an anonymous CORS request, and a
 * preload whose credentials mode differs from the eventual fetch is silently
 * discarded — the browser downloads the file twice and the preload buys nothing.
 * The poster is consumed as a CSS background and a `<video poster>`, neither of
 * which is a CORS request, so tagging it would break it the other way.
 *
 * ── Rules for editing ───────────────────────────────────────────────────────
 * It is blocking, so keep it tiny; and it must never throw, because an
 * exception here happens before anything has rendered. Everything is inside one
 * try/catch and every failure path falls back to plain, which is the document
 * the server already sent.
 */

/** Precomputed hour → phase, so the inline script carries no logic of its own
 *  and cannot drift from `timeOfDay.ts`. */
const HOUR_PHASE = Array.from({ length: 24 }, (_, h) => resolvedPhaseForHour(h));

export const BOOT_SCRIPT = `(function(){try{
var d=document.documentElement,m=window.matchMedia,p=true;
if(m("(prefers-reduced-motion: reduce)").matches)p=false;
if(p&&m("(width < ${MIN_WIDTH}px)").matches)p=false;
if(p){try{var c=document.createElement("canvas");
p=!!(c.getContext("webgl2")||c.getContext("webgl")||c.getContext("experimental-webgl"));
}catch(e){p=false}}
if(p){try{if(localStorage.getItem("${READING_MODE_KEY}")==="plain")p=false}catch(e){}}
d.setAttribute("data-np-mode",p?"paper":"plain");
if(!p)return;
var f=${JSON.stringify(HOUR_PHASE)}[new Date().getHours()];
d.setAttribute("data-np-phase",f);
d.style.setProperty("--np-boot-room",'url("/backdrop/'+f+'.avif")');
function pre(h,x){var l=document.createElement("link");l.rel="preload";l.as="image";
l.href=h;if(x)l.crossOrigin="anonymous";document.head.appendChild(l)}
pre("/backdrop/"+f+".avif",0);pre("/pages/01.avif",1);pre("/pages/02.avif",1)
}catch(e){}})();`;
