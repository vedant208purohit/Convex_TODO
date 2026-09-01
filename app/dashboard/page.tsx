"use client";

import { PosShell } from "../components/PosShell";
import { DigitalMenuCatalog } from "../components/DigitalMenuCatalog";

const stats = [
  { title: "Total Sales", value: "$4,285.50", delta: "+12.5% from yesterday", icon: "▣" },
  { title: "Total Orders", value: "124", delta: "+8% from yesterday", icon: "▤" },
  { title: "Avg Order Value", value: "$34.56", delta: "Consistent", icon: "▥" },
  { title: "Delivery Time", value: "28 min", delta: "+2 min average", icon: "◔" },
];

const sourceData = [
  { label: "Dine-in", value: "45%", width: "w-[45%]" },
  { label: "Delivery", value: "35%", width: "w-[35%]" },
  { label: "Takeout", value: "20%", width: "w-[20%]" },
];

export default function DashboardPage() {
  return (
    <PosShell title="Management Portal" subtitle="Analytics">
      <div className="space-y-8">
        <section className="space-y-3">
          <h1 className="text-[21px] font-medium">Today’s Overview</h1>
          <p className="text-[16px] text-[#6f655e]">Real-time performance metrics and insights.</p>
        </section>

        <section className="grid gap-5 xl:grid-cols-4">
          {stats.map((item) => (
            <article key={item.title} className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
              <div className="flex items-start justify-between">
                <h2 className="text-[17px] font-medium text-[#2d2622]">{item.title}</h2>
                <span className="text-[20px] text-[#5f564f]">{item.icon}</span>
              </div>
              <div className="mt-14 space-y-2">
                <div className="text-[17px] font-medium text-[#1f1a17]">{item.value}</div>
                <div className="text-[15px] text-[#6f655e]">{item.delta}</div>
              </div>
            </article>
          ))}
        </section>

        <section>
          <DigitalMenuCatalog />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.9fr_1fr]">
          <article className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4]">
            <div className="flex items-center justify-between border-b border-[#eadfd6] px-6 py-5">
              <h2 className="text-[18px] font-medium">Restaurant Overview</h2>
              <div className="flex items-center gap-2 text-[14px]">
                <span className="rounded-full bg-[#d0c7c0] px-3 py-1 font-medium text-[#1f1a17]">Day</span>
                <span className="px-2 text-[#6f655e]">Week</span>
              </div>
            </div>
            <div className="flex min-h-[420px] items-center justify-center px-6 py-10 text-center">
              <div className="max-w-md space-y-4">
                <div className="text-5xl text-[#cfc3bb]">✦</div>
                <div className="text-[18px] font-medium">No data available</div>
                <p className="text-[15px] leading-6 text-[#6f655e]">
                  There is not enough data to generate the overview chart for the selected period.
                </p>
              </div>
            </div>
          </article>

          <div className="space-y-6">
            <article className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6">
              <h2 className="text-[18px] font-medium">Top Item</h2>
              <div className="mt-7 flex items-center gap-4">
                <div className="h-[80px] w-[80px] rounded-2xl bg-[linear-gradient(135deg,#6a4d35,#d7a35c_55%,#3f2a1f)] shadow-inner" />
                <div className="space-y-1">
                  <div className="text-[18px] font-medium">Truffle Burger</div>
                  <div className="text-[15px] text-[#6f655e]">48 orders today</div>
                  <div className="text-[15px]">864.00 Revenue</div>
                </div>
              </div>
            </article>

            <article className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6">
              <h2 className="text-[18px] font-medium">Order Source Overview</h2>
              <div className="mt-6 space-y-5">
                {sourceData.map((item) => (
                  <div key={item.label} className="grid grid-cols-[24px_1fr_auto] items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#e8e0d8] text-[14px]">◫</div>
                    <div>
                      <div className="flex items-center justify-between text-[15px] font-medium">
                        <span>{item.label}</span>
                        <span className="font-normal text-[#6f655e]">{item.value}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-[#ece4dc]">
                        <div className={`h-2 rounded-full bg-[#1f1a17] ${item.width}`} />
                      </div>
                    </div>
                    <span />
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      </div>
    </PosShell>
  );
}
