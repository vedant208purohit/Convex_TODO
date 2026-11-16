import { Suspense } from "react";
import { Metadata } from "next";
import { RazorpaySettlementDetailsView } from "../../../../components/marketplace/RazorpaySettlementDetailsView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Settlement ${id} | Razorpay | PREST Marketplace`,
    description: `Audit details, payout destination, and activity timeline for settlement ${id}.`,
  };
}

export default async function RazorpaySettlementDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fff8f5]">
          <div className="flex items-center gap-3 text-stone-600 font-sans text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">
              progress_activity
            </span>
            <span>Loading Settlement Details...</span>
          </div>
        </div>
      }
    >
      <RazorpaySettlementDetailsView settlementId={id} embeddedInMarketplace={false} />
    </Suspense>
  );
}

