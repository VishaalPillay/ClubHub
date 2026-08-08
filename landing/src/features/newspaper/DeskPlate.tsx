import Image from "next/image";
import { DESK } from "./deskAssets";

/**
 * The desk surface. Server component, fully decorative (`aria-hidden`, `alt=""`).
 *
 * It sits OUTSIDE the 3D stack — a plain absolutely-positioned sibling behind
 * `.np-stack` inside `.np-stage`. The stage owns `perspective` but stays
 * `transform-style: flat`: it is the camera, and it flattens its subtree into
 * itself, which is exactly right for a backdrop.
 *
 * Until `DESK.plate` is set, a procedural wood surface stands in so the whole
 * experience works without any assets.
 */
export default function DeskPlate() {
  return (
    <div className="np-desk" aria-hidden="true" style={{ background: DESK.base }}>
      {DESK.plate ? (
        <Image
          src={DESK.plate}
          alt=""
          fill
          priority
          fetchPriority="high"
          quality={70}
          sizes="100vw"
          placeholder="blur"
          blurDataURL={DESK.blurDataURL}
          style={{ objectFit: "cover" }}
        />
      ) : (
        <div className="np-desk-proc" />
      )}
      <div className="np-desk-vignette" />
    </div>
  );
}
