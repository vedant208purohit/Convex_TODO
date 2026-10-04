const fs = require('fs');

// 1. Update CustomerCartContext.tsx
const cartContextPath = 'c:/Workspace/pos-user/app/components/customer/CustomerCartContext.tsx';
let cartContent = fs.readFileSync(cartContextPath, 'utf8');

const targetContext = `    let modeFromUrl: CustomerServiceMode | null = null;
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const rawType = searchParams.get("type") || searchParams.get("qr_type") || searchParams.get("service") || "";
      const upper = rawType.toUpperCase().trim();
      if (upper === "TAKEAWAY" || upper === "TAKE_AWAY") modeFromUrl = "takeaway";
      else if (upper === "DELIVERY") modeFromUrl = "delivery";
      else if (upper === "DINEIN" || upper === "DINE_IN") modeFromUrl = "dine_in";
    }`;

const newContext = `    let modeFromUrl: CustomerServiceMode | null = null;
    let initialTimingFromUrl: any = null;
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const rawType = searchParams.get("type") || searchParams.get("qr_type") || searchParams.get("service") || "";
      const isScheduled = searchParams.get("scheduled") === "true";
      const upper = rawType.toUpperCase().trim();
      if (upper === "TAKEAWAY" || upper === "TAKE_AWAY") {
        modeFromUrl = "takeaway";
      } else if (upper === "DELIVERY") {
        modeFromUrl = "delivery";
      } else if (upper === "DINEIN" || upper === "DINE_IN") {
        modeFromUrl = "dine_in";
      } else if (upper === "QUEUE" || upper === "SCHEDULE" || upper === "SCHEDULED" || isScheduled) {
        modeFromUrl = "takeaway";
        const todayStr = new Date().toISOString().slice(0, 10);
        initialTimingFromUrl = { mode: "scheduled", date: todayStr, timeSlot: "12:30 PM - 01:00 PM" };
      }
    }`;

if (cartContent.includes(targetContext)) {
  cartContent = cartContent.replace(targetContext, newContext);
  cartContent = cartContent.replace(
    'deliveryTiming: meta.deliveryTiming || shared.deliveryTiming || { mode: "now" as const },',
    'deliveryTiming: initialTimingFromUrl || meta.deliveryTiming || shared.deliveryTiming || { mode: "now" as const },'
  );
  fs.writeFileSync(cartContextPath, cartContent, 'utf8');
  console.log('Successfully updated CustomerCartContext.tsx for Schedule Pickup');
} else {
  console.log('Target context not found in CustomerCartContext.tsx');
}

// 2. Add Schedule Pickup Date & Time Selector to CustomerTakeawayCartView.tsx
const takeawayViewPath = 'c:/Workspace/pos-user/app/components/customer/CustomerTakeawayCartView.tsx';
let takeawayContent = fs.readFileSync(takeawayViewPath, 'utf8');

const targetPickupSection = `<div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <LocationPinIcon className="w-4 h-4 text-[#2a14b4]" />
            <span className="text-xs font-bold text-[#131b2e]">
              Pickup Details
            </span>
          </div>
          <span className="text-xs text-[#005e3f] font-semibold flex items-center gap-0.5">
            <span className="text-xs">⏱️</span>
            15-20 mins
          </span>
        </div>`;

const newPickupSection = `<div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <LocationPinIcon className="w-4 h-4 text-[#2a14b4]" />
            <span className="text-xs font-bold text-[#131b2e]">
              Pickup Details & Timing
            </span>
          </div>
          <span className="text-xs text-[#005e3f] font-semibold flex items-center gap-0.5">
            <span className="text-xs">⏱️</span>
            {deliveryTiming?.mode === "scheduled" ? "Scheduled Pickup" : "15-20 mins"}
          </span>
        </div>

        {/* Schedule Pickup Timing Mode Switcher */}
        <div className="flex p-1 bg-[#eaedff] rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setDeliveryTiming({ mode: "now" })}
            className={\`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer \${
              deliveryTiming?.mode !== "scheduled"
                ? "bg-[#4338ca] text-white shadow-xs"
                : "text-[#464554] hover:text-[#131b2e]"
            }\`}
          >
            ⚡ ASAP Pickup (15-20m)
          </button>
          <button
            type="button"
            onClick={() => {
              const todayStr = new Date().toISOString().slice(0, 10);
              setDeliveryTiming({
                mode: "scheduled",
                date: deliveryTiming?.date || todayStr,
                timeSlot: deliveryTiming?.timeSlot || "12:30 PM - 01:00 PM",
              });
            }}
            className={\`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer \${
              deliveryTiming?.mode === "scheduled"
                ? "bg-[#4338ca] text-white shadow-xs"
                : "text-[#464554] hover:text-[#131b2e]"
            }\`}
          >
            📅 Schedule Pickup Time
          </button>
        </div>

        {/* Scheduled Slot Picker Card */}
        {deliveryTiming?.mode === "scheduled" && (
          <div className="bg-[#eef2ff] border border-[#c7d2fe] rounded-xl p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#4338ca] uppercase tracking-wider">
                Select Pickup Time Slot
              </span>
              <span className="text-xs text-indigo-700 font-bold">
                {deliveryTiming.timeSlot || "12:30 PM - 01:00 PM"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                "12:00 PM - 12:30 PM",
                "12:30 PM - 01:00 PM",
                "01:00 PM - 01:30 PM",
                "01:30 PM - 02:00 PM",
                "06:00 PM - 06:30 PM",
                "07:00 PM - 07:30 PM",
              ].map((slot) => {
                const isSelected = deliveryTiming.timeSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() =>
                      setDeliveryTiming({
                        ...deliveryTiming,
                        mode: "scheduled",
                        timeSlot: slot,
                      })
                    }
                    className={\`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition text-center cursor-pointer \${
                      isSelected
                        ? "bg-[#4338ca] text-white font-bold shadow-xs"
                        : "bg-white text-slate-700 hover:bg-indigo-50 border border-indigo-100"
                    }\`}
                  >
                    {isSelected ? "✓ " : ""}{slot}
                  </button>
                );
              })}
            </div>
          </div>
        )}`;

if (takeawayContent.includes(targetPickupSection)) {
  takeawayContent = takeawayContent.replace(targetPickupSection, newPickupSection);
  fs.writeFileSync(takeawayViewPath, takeawayContent, 'utf8');
  console.log('Successfully updated CustomerTakeawayCartView.tsx with Schedule Pickup UI');
} else {
  console.log('Target section not found in CustomerTakeawayCartView.tsx');
}
