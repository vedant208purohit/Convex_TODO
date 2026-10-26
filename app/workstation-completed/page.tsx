"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WorkstationCompletedRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/workstation");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-[#faf2ee]">
      <div className="animate-spin w-6 h-6 border-2 border-black border-t-transparent rounded-full" />
    </div>
  );
}
