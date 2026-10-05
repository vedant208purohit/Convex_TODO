"use client";

import { QRCodeSVG } from "qrcode.react";

interface DynamicQrCodeProps {
  value: string;
  size?: number;
  className?: string;
  fgColor?: string;
  bgColor?: string;
}

export function DynamicQrCode({
  value,
  size = 250,
  className = "w-full h-full min-h-[140px]",
  fgColor = "#141010",
  bgColor = "#ffffff",
}: DynamicQrCodeProps) {
  if (!value || !value.trim()) {
    return (
      <div className={`flex flex-col items-center justify-center bg-[#fdf8f7] p-4 text-xs text-[#5e5e5e] border border-[#e7e5e4] rounded-xl ${className}`}>
        <span>No QR Link Data</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center p-2 bg-white rounded-xl">
      <QRCodeSVG
        value={value}
        size={size}
        bgColor={bgColor}
        fgColor={fgColor}
        level="M"
        marginSize={2}
        style={{ width: "100%", height: "auto", maxWidth: "100%", aspectRatio: "1/1" }}
      />
    </div>
  );
}
