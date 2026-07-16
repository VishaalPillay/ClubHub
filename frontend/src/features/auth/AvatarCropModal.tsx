"use client";

import { useState } from "react";
import Cropper from "react-easy-crop";
import { getCroppedAvatar, type CropArea } from "@/features/auth/cropImage";

/**
 * LinkedIn-style portrait framing: pan + zoom behind a round mask, so the user
 * chooses exactly which part of the photo is visible. Confirm hands the caller a
 * 512×512 blob of the selected area.
 */
export default function AvatarCropModal({
  src,
  busy,
  onConfirm,
  onCancel,
}: {
  src: string;
  busy: boolean;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<CropArea | null>(null);
  const [error, setError] = useState("");

  const confirm = async () => {
    if (!areaPixels) return;
    setError("");
    try {
      onConfirm(await getCroppedAvatar(src, areaPixels));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not crop the image.");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="bg-white border-2 border-black w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b-2 border-black">
          <p className="font-mono text-[11px] uppercase tracking-widest text-[#757575] mb-1">
            Portrait
          </p>
          <h3 className="font-display text-[24px] leading-[1.05] font-bold">
            Frame your photo.
          </h3>
        </div>

        {/* Cropper needs a positioned, fixed-height container */}
        <div className="relative h-72 bg-[#1a1a1a]">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, px) => setAreaPixels(px)}
          />
        </div>

        <div className="px-6 py-4 flex items-center gap-4 border-b border-[#e2e8f0]">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#757575]">
            Zoom
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[#057DBC]"
            aria-label="Zoom"
          />
        </div>

        {error && (
          <p className="px-6 pt-3 font-mono text-[11px] text-red-600 uppercase tracking-widest">
            {error}
          </p>
        )}

        <div className="px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="font-ui text-[12px] font-bold border-2 border-black px-5 py-2.5 uppercase hover:bg-black hover:text-white transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy || !areaPixels}
            className="font-ui text-[12px] font-bold border-2 border-[#057DBC] bg-[#057DBC] text-white px-5 py-2.5 uppercase hover:bg-black hover:border-black transition-colors disabled:opacity-40"
          >
            {busy ? "Uploading…" : "Use photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
