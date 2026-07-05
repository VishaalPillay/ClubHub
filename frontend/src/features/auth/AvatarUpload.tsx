"use client";

import { useRef, useState } from "react";
import { uploadAvatar } from "@/lib/api/users";

const ACCEPT = "image/png,image/jpeg,image/webp";

/**
 * Drag-and-drop / click-to-browse avatar upload. Uploads immediately on selection
 * (the caller is already authenticated after registration step 1) and reports the
 * stored URL back up. Square editorial dropzone; round preview per the system's
 * one radius exception.
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file: File | undefined) => {
    if (!file || busy) return;
    setError("");
    setBusy(true);
    try {
      const profile = await uploadAvatar(file);
      onUploaded(profile.avatar_url);
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
            PNG / JPG / WebP · ≤ 5 MB · resized to 512×512
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
    </div>
  );
}
