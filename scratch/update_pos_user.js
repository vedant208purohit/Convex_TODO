const fs = require('fs');
const filePath = 'c:/Workspace/pos-user/app/components/customer/CustomerCartContext.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const target = 'serviceMode: meta.serviceMode || shared.serviceMode || "dine_in",';
const replacement = `let modeFromUrl: CustomerServiceMode | null = null;
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const rawType = searchParams.get("type") || searchParams.get("qr_type") || searchParams.get("service") || "";
      const upper = rawType.toUpperCase().trim();
      if (upper === "TAKEAWAY" || upper === "TAKE_AWAY") modeFromUrl = "takeaway";
      else if (upper === "DELIVERY") modeFromUrl = "delivery";
      else if (upper === "DINEIN" || upper === "DINE_IN") modeFromUrl = "dine_in";
    }

    const serviceMode = modeFromUrl || meta.serviceMode || shared.serviceMode || (tableId ? "dine_in" : "takeaway");`;

if (content.includes(target)) {
  content = content.replace(target, 'serviceMode,');
  content = content.replace('const meta = getStoredMeta(metadataStorageKey);', replacement + '\n    const meta = getStoredMeta(metadataStorageKey);');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated CustomerCartContext.tsx');
} else {
  console.log('Target string not found in file');
}
