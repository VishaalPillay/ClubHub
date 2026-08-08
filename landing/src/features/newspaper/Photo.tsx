import Image from "next/image";

/**
 * A printed photograph. Grayscale + contrast + a synthesized halftone screen are
 * applied in CSS (see `.np-photo` in newspaper.css), so colour originals can be
 * dropped in unmodified.
 *
 * Until the press photography lands in `public/press/`, this renders an honest
 * "art to come" placeholder — which is real newspaper furniture, not a broken
 * image. Pass `src` and it becomes a real optimised photo with no other change.
 */
/**
 * `crop` is a data attribute rather than an inline aspect-ratio so the mobile
 * tabloid can override it. Anything set inline — including a CSS custom property
 * — is set ON the element and therefore beats every stylesheet rule targeting
 * that same element, and a 4:5 photo stacked in a single column eats a third of
 * the sheet.
 */
export default function Photo({
  src,
  alt = "",
  caption,
  crop = "wide",
  priority = false,
}: {
  src?: string;
  alt?: string;
  caption?: string;
  crop?: "wide" | "tall" | "square";
  priority?: boolean;
}) {
  return (
    <figure className="np-figure">
      <div className="np-photo" data-crop={crop}>
        {src ? (
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 1023px) 90vw, 42vw"
            priority={priority}
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div className="np-photo-hold" aria-hidden="true">
            <span className="np-micro">Photograph to come</span>
          </div>
        )}
      </div>
      {caption ? <figcaption className="np-figcaption">{caption}</figcaption> : null}
    </figure>
  );
}
