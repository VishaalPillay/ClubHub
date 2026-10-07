import {
  FORCE_TIER_KEY,
  MIN_WIDTH,
  READING_MODE_KEY,
  SCENE_FAILED_KEY,
  TRANSIENT_FAILURES,
} from "./readingMode";
import { ROOM_POSTER } from "../scene/roomLight";

/**
 * The blocking script that decides how the page looks BEFORE first paint.
 *
 * ── The problem it exists to solve ───────────────────────────────────────────
 * Reading mode is decided on the client, from things the server cannot know:
 * reduced-motion, viewport width, whether WebGL works. `useSyncExternalStore`
 * handles that correctly — but "correctly" means the decision lands at
 * HYDRATION, and the server document is the plain eight-page newspaper. So a
 * desktop visitor got a full-screen cream broadsheet for as long as the bundle
 * took to arrive and hydrate before it was replaced by the room. A blocking inline
 * script is the only fix: nothing that runs after the bundle can prevent something
 * the browser has already painted. This decides the same thing `getReadingMode`
 * will decide later and writes it onto <html>, where CSS acts on it immediately.
 *
 * ── The device tier ──────────────────────────────────────────────────────────
 * It also decides how much 3D this machine and connection should get, and writes it
 * as <html data-np-tier>:
 *
 *   low   → the plain edition, no 3D at all. Data Saver on; a 2G/3G connection;
 *           2 GB of memory or 2 cores or fewer; software-only graphics (SwiftShader,
 *           llvmpipe, Microsoft Basic Render — a laptop whose GPU driver is missing
 *           runs WebGL on the CPU, and the scene would crawl); a GPU that cannot hold
 *           a 4096px texture.
 *   mid   → the scene, lighter: lower resolution, 2x pages, plain kraft, the 720p
 *           clip. 4 GB or 4 cores or fewer.
 *   high  → everything.
 *
 * The MACHINE decides the tier; the connection only decides what is downloaded. A link
 * that is BOTH under 5 Mbps and slow to answer (round trip ≥ 300 ms) is written
 * separately as <html data-np-net="slow"> and gets 2x pages and the light clip on
 * whatever tier the machine earned. Never the downlink alone: Chrome's figure starts
 * around 1.5 Mbps on a fresh session, before it has measured anything, with a round
 * trip of 0 — so a fast laptop on good wifi read as "slow" and lost the room video and
 * the sharp pages. (It once dropped the whole tier for the same reason.)
 *
 * Every signal is optional — Safari and Firefox expose no memory figure and no
 * connection info — and a missing one never pushes a device DOWN a tier. The
 * runtime watchdogs in NewspaperShell catch what this cannot see.
 *
 * WebGL2 specifically is required: three.js has been WebGL2-only since r163.
 *
 * ── What it starts downloading ──────────────────────────────────────────────
 * Only what the first frame needs: the room's poster, the folder label (30 KB) and
 * the page manifest (meta.json). Pages are not on the first frame — the folder is
 * shut — so none of them are preloaded. **The label and manifest are preloaded
 * `crossOrigin="anonymous"`; the poster must not be.** A preload whose credentials
 * mode differs from the eventual fetch is discarded and the file downloads twice;
 * three's loaders and fetch() are CORS requests, a CSS background and a <video
 * poster> are not.
 *
 * ── Rules for editing ───────────────────────────────────────────────────────
 * It is blocking, so keep it tiny; and it must never throw, because an exception
 * here happens before anything has rendered. Everything is inside try/catch and
 * every failure path falls back to plain, which is the document the server sent.
 */

export const BOOT_SCRIPT = `(function(){try{
var d=document.documentElement,w=window,mm=w.matchMedia,n=navigator,p=true,t="high",ls=null,ss=null;
try{ls=w.localStorage}catch(e){}
try{ss=w.sessionStorage}catch(e){}
var force=ls&&ls.getItem("${FORCE_TIER_KEY}");
var gl=null,sw=false,mt=0;
try{var c=document.createElement("canvas");gl=c.getContext("webgl2");
if(gl){var dbg=gl.getExtension("WEBGL_debug_renderer_info");
var r=String(dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER));
sw=/swiftshader|llvmpipe|softpipe|software|basic render/i.test(r);
mt=gl.getParameter(gl.MAX_TEXTURE_SIZE)||0;
var lc=gl.getExtension("WEBGL_lose_context");if(lc)lc.loseContext()}
}catch(e){gl=null}
var cn=n.connection||{},mem=n.deviceMemory,cores=n.hardwareConcurrency,et=cn.effectiveType||"",dl=cn.downlink;
if(cn.saveData||/(^|-)2g|3g/.test(et)||(mem&&mem<=2)||(cores&&cores<=2)||sw||(mt&&mt<4096))t="low";
else if((mem&&mem<=4)||(cores&&cores<=4))t="mid";
if(dl&&dl<5&&cn.rtt>=300)d.setAttribute("data-np-net","slow");
if(force==="high"||force==="mid"||force==="low"){t=force;d.setAttribute("data-np-forced","1")}
d.setAttribute("data-np-tier",t);
if(mm("(prefers-reduced-motion: reduce)").matches)p=false;
if(p&&mm("(width < ${MIN_WIDTH}px)").matches)p=false;
if(p&&!gl)p=false;
if(p&&t==="low")p=false;
if(p&&ls&&ls.getItem("${READING_MODE_KEY}")==="plain")p=false;
var sf=ss&&ss.getItem("${SCENE_FAILED_KEY}");
if(sf&&${JSON.stringify(TRANSIENT_FAILURES)}.indexOf(sf)>=0){ss.removeItem("${SCENE_FAILED_KEY}");sf=null}
if(p&&sf)p=false;
d.setAttribute("data-np-mode",p?"paper":"plain");
if(!p)return;
function pre(h,x,a){var l=document.createElement("link");l.rel="preload";l.as=a||"image";
l.href=h;if(x)l.crossOrigin="anonymous";document.head.appendChild(l)}
pre("${ROOM_POSTER}",0);pre("/brand/clubhub-480.webp",1);pre("/pages/meta.json",1,"fetch")
}catch(e){}})();`;
