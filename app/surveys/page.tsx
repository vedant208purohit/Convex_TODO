"use client";

import { PosShell } from "../components/PosShell";
import { ComingSoonOverlay } from "../components/ComingSoonOverlay";

export default function SurveysPage() {
  return (
    <PosShell title="Surveys" subtitle="Customer Feedback">
      <ComingSoonOverlay
        title="Customer Surveys & Feedback"
        description="Guest experience surveys, CSAT ratings, NPS analytics, and automated post-checkout feedback collection will be available here soon."
      >
        <div className="flex-1 min-h-0 overflow-y-auto p-6 lg:p-8 space-y-6">
          {/* Header Metric Cards */}
          <section className="grid gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
              <div className="flex items-start justify-between">
                <h2 className="text-[15px] font-medium text-[#2d2622]">Customer Satisfaction (CSAT)</h2>
                <span className="text-[18px] text-[#5f564f]">★</span>
              </div>
              <div className="mt-8 space-y-1">
                <div className="text-2xl font-semibold text-[#1f1a17]">4.8 / 5.0</div>
                <div className="text-[13px] text-[#6f655e]">Based on 342 ratings</div>
              </div>
            </article>

            <article className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
              <div className="flex items-start justify-between">
                <h2 className="text-[15px] font-medium text-[#2d2622]">Active Surveys</h2>
                <span className="text-[18px] text-[#5f564f]">📋</span>
              </div>
              <div className="mt-8 space-y-1">
                <div className="text-2xl font-semibold text-[#1f1a17]">2 Active</div>
                <div className="text-[13px] text-[#6f655e]">Dine-in & Digital Checkout</div>
              </div>
            </article>

            <article className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
              <div className="flex items-start justify-between">
                <h2 className="text-[15px] font-medium text-[#2d2622]">Response Rate</h2>
                <span className="text-[18px] text-[#5f564f]">📈</span>
              </div>
              <div className="mt-8 space-y-1">
                <div className="text-2xl font-semibold text-[#1f1a17]">68.4%</div>
                <div className="text-[13px] text-[#6f655e]">+4.2% from last week</div>
              </div>
            </article>

            <article className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
              <div className="flex items-start justify-between">
                <h2 className="text-[15px] font-medium text-[#2d2622]">Net Promoter Score (NPS)</h2>
                <span className="text-[18px] text-[#5f564f]">💬</span>
              </div>
              <div className="mt-8 space-y-1">
                <div className="text-2xl font-semibold text-[#1f1a17]">+72</div>
                <div className="text-[13px] text-[#6f655e]">World-class tier</div>
              </div>
            </article>
          </section>

          {/* Survey Management Table Preview */}
          <section className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-[#1f1a17]">Active Survey Campaigns</h3>
                <p className="text-xs text-[#6f655e]">Feedback questionnaires presented to guests</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#2d2622]">
                <thead className="border-b border-[#eadfd6] text-xs uppercase text-[#6f655e]">
                  <tr>
                    <th className="py-3 px-4">Survey Name</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Responses</th>
                    <th className="py-3 px-4">Avg Score</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eadfd6]/60">
                  <tr>
                    <td className="py-3.5 px-4 font-medium">Post-Dining Experience</td>
                    <td className="py-3.5 px-4 text-[#6f655e]">Table QR / Front Display</td>
                    <td className="py-3.5 px-4">218</td>
                    <td className="py-3.5 px-4">4.9 / 5.0</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Live
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 font-medium">Digital Checkout Feedback</td>
                    <td className="py-3.5 px-4 text-[#6f655e]">WhatsApp E-Receipt</td>
                    <td className="py-3.5 px-4">124</td>
                    <td className="py-3.5 px-4">4.7 / 5.0</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Live
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </ComingSoonOverlay>
    </PosShell>
  );
}
