interface EditorialRibbonProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * WIRED Editorial Ribbon — full-bleed black section header bar.
 *
 * Black background, white WiredMono ALL-CAPS text.
 * Height ~32–40px. No rounded ends. No shadow.
 * Used for section markers: "REGISTRATION", "ONBOARDING", "MOST POPULAR", etc.
 */
export function EditorialRibbon({ children, className = "" }: EditorialRibbonProps) {
  return (
    <div className={`wired-ribbon ${className}`}>
      {children}
    </div>
  );
}
