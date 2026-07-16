"use client";

import { useEffect, useRef, useState } from "react";
import { uploadAvatar } from "@/lib/api/users";
import AvatarCropModal from "@/features/auth/AvatarCropModal";

const ACCEPT = "image/png,image/jpeg,image/webp";

/**
 * Drag-and-drop / click-to-browse avatar upload. Picking a file opens a crop
 * dialog (pan + zoom, round mask) so the user frames the visible area themselves;
 * only the confirmed 512² crop is uploaded. Reports the stored URL back up.
 */
export default function AvatarUpload({
  initials,
  avatarUrl,
  onUploaded,
}: {
  initials: string;
  avatarUrl: string | null;
  onUploaded: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingSrc, setPendingSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Revoke the preview object URL whenever it's replaced or on unmount.
  useEffect(() => {
    return () => {
      if (pendingSrc) URL.revokeObjectURL(pendingSrc);
    };
  }, [pendingSrc]);

  const handleFile = (file: File | undefined) => {
    if (!file || busy) return;
    if (!ACCEPT.split(",").includes(file.type)) {
      setError("Use a PNG, JPG, or WebP image.");
      return;
    }
    setError("");
    setPendingSrc(URL.createObjectURL(file));
  };

  const handleCropConfirm = async (blob: Blob) => {
    setBusy(true);
    setError("");
    try {
      const ext = blob.type === "image/png" ? "png" : "jpg";
      const profile = await uploadAvatar(new File([blob], `avatar.${ext}`, { type: blob.type }));
      onUploaded(profile.avatar_url);
      setPendingSrc(null); // effect revokes the object URL
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[11px] uppercase tracking-widest text-[#757575]">
        Portrait <span className="text-[#b3b0ab] tracking-wider">— optional</span>
      </span>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a profile picture"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`border-2 border-dashed p-5 flex items-center gap-5 cursor-pointer transition-colors focus:outline-none focus:border-[#057DBC] ${
          dragOver ? "border-[#057DBC] bg-[#f7f6f4]" : "border-black hover:bg-[#f7f6f4]"
        }`}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- runtime-uploaded URL (local /media or S3), not a static asset
          <img
            src={avatarUrl}
            alt="Your profile picture"
            className="w-16 h-16 rounded-full object-cover border-2 border-black flex-none"
          />
        ) : (
          <span className="w-16 h-16 rounded-full border-2 border-black flex items-center justify-center font-display text-[22px] font-bold flex-none">
            {initials || "?"}
          </span>
        )}
        <div>
          <p className="font-ui text-[13px] font-bold uppercase tracking-wide m-0">
            {busy ? "Uploading…" : avatarUrl ? "Looks good — click to replace" : "Drop a photo, or click to browse"}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#757575] m-0 mt-1">
            PNG / JPG / WebP · ≤ 5 MB · you choose the visible area
          </p>
        </div>
      </div>
      {error && (
        <p className="font-mono text-[11px] text-red-600 uppercase tracking-widest m-0">{error}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />

      {pendingSrc && (
        <AvatarCropModal
          src={pendingSrc}
          busy={busy}
          onConfirm={handleCropConfirm}
          onCancel={() => !busy && setPendingSrc(null)}
        />
      )}
    </div>
  );
}
