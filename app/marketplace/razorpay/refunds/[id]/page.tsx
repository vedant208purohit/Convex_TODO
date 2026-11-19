import { Suspense } from "react";
import { Metadata } from "next";
import { RazorpayRefundDetailsView } from "../../../../components/marketplace/RazorpayRefundDetailsView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Refund ${id} | PREST Marketplace`,
    description: `Audit details and status timeline for refund ${id}.`,
  };
}

export default async function RazorpayRefundDetailsPage({
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
            <span>Loading Refund Details...</span>
          </div>
        </div>
      }
    >
      <RazorpayRefundDetailsView refundId={id} embeddedInMarketplace={false} />
    </Suspense>
  );
}

