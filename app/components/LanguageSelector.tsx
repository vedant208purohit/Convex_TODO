"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";

export function LanguageSelector({
  onLanguageChange,
}: {
  onLanguageChange?: (code: string) => void;
}) {
  const { isSignedIn } = useAuth();
  const organizations = useQuery(api.organizations.list);
  const organization = organizations?.[0] ?? null;
  const currentMembership = useQuery(
    api.organizationUsers.getCurrentMembership,
    organization?._id ? { organizationId: organization._id } : "skip"
  );
  const languages = useQuery(
    api.organizationLanguages.list,
    isSignedIn && currentMembership ? {} : "skip"
  );
  const [selectedCode, setSelectedCode] = useState<string>("");

  useEffect(() => {
    if (languages && languages.length > 0 && !selectedCode) {
      const stored = typeof window !== "undefined" ? localStorage.getItem("pos_selected_language") : null;
      const defaultLang = languages.find((l) => l.isDefault) ?? languages[0];
      const initialCode = stored && languages.some((l) => l.code === stored) ? stored : defaultLang.code;
      setSelectedCode(initialCode);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pos_language_change", { detail: { code: initialCode } }));
      }
      if (onLanguageChange) {
        onLanguageChange(initialCode);
      }
    }
  }, [languages, selectedCode, onLanguageChange]);

  const handleChange = (code: string) => {
    setSelectedCode(code);
    if (typeof window !== "undefined") {
      localStorage.setItem("pos_selected_language", code);
      window.dispatchEvent(new CustomEvent("pos_language_change", { detail: { code } }));
    }
    if (onLanguageChange) {
      onLanguageChange(code);
    }
  };

  if (languages === undefined) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-[#eadfd6] bg-[#f0ebe6] px-3 py-1.5 text-xs text-[#786d65]">
        <span>🌐</span>
        <span>Loading...</span>
      </div>
    );
  }

  if (languages.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-[#eadfd6] bg-white px-3 py-1.5 text-xs text-[#1f1a17] shadow-sm">
      <span className="text-xs text-[#6f655e]">🌐</span>
      <select
        value={selectedCode}
        onChange={(e) => handleChange(e.target.value)}
        className="bg-transparent text-xs font-medium text-[#1f1a17] outline-none cursor-pointer"
        aria-label="Select Menu Language"
      >
        {languages.map((lang) => (
          <option key={lang._id} value={lang.code}>
            {lang.name} ({lang.code.toUpperCase()}) {lang.isDefault ? "★" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
