"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  generateDefxKotPlainString,
  generateWorkstationRunnerSlipPlainString,
  generateDefxReceiptPlainString,
  printThermalReceiptDocument,
  KotOrder,
  ReceiptOrder,
} from "../utils/defxReceiptFormatter";

export default function GlobalOrderAutoPrinter() {
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;

  const printers = useQuery(
    api.organizationPrinters.list,
    activeOrg ? {} : "skip"
  );

  const liveOrders = useQuery(
    api.orders.listLiveOrders,
    activeOrg ? { organizationId: activeOrg._id } : "skip"
  );

  const orgFeatures = useQuery(
    api.organizationFeatures.list,
    activeOrg ? { organizationId: activeOrg._id } : "skip"
  );

  const isInitialLiveOrderLoadRef = useRef(true);
  const seenLiveOrderIdsRef = useRef<Set<string>>(new Set());
  const printedLiveOrderIdsRef = useRef<Set<string>>(new Set());
  const seenOrderItemCountsRef = useRef<Map<string, number>>(new Map());

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4500);
  };

  useEffect(() => {
    if (!liveOrders || !activeOrg) return;

    // Load any previously printed order IDs from sessionStorage so refreshing does not duplicate prints
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("pos_auto_printed_order_ids");
        if (stored) {
          const arr = JSON.parse(stored);
          if (Array.isArray(arr)) {
            arr.forEach((id: string) => printedLiveOrderIdsRef.current.add(id));
          }
        }
      } catch {}
    }

    // On initial mount/load, mark all existing open orders as seen to prevent printing old historical orders
    if (isInitialLiveOrderLoadRef.current) {
      liveOrders.forEach((o: any) => {
        const orderIdStr = String(o._id);
        seenLiveOrderIdsRef.current.add(orderIdStr);
        printedLiveOrderIdsRef.current.add(orderIdStr);
        seenOrderItemCountsRef.current.set(orderIdStr, o.items?.length || 0);
      });
      isInitialLiveOrderLoadRef.current = false;
      return;
    }

    const stationPrinter =
      printers?.find((p) => p.printerUseFor === "Station") || printers?.[0];
    const workstationPrinter =
      printers?.find((p) => p.printerUseFor === "WorkStation");
    const cashierPrinter =
      printers?.find((p) => p.printerUseFor === "Cashier");

    const getFlag = (k: string) =>
      orgFeatures?.find((f) => f.featureKey === k)?.active ?? false;

    for (const order of liveOrders) {
      const orderIdStr = String(order._id);
      const isNewOrder = !seenLiveOrderIdsRef.current.has(orderIdStr);
      const prevItemCount = seenOrderItemCountsRef.current.get(orderIdStr) ?? 0;
      const currentItemCount = order.items?.length || 0;

      const isOnlineOrQr =
        order.orderSource === "PREST-QR" ||
        order.orderSource === "Prest-Online" ||
        (typeof order.orderSource === "string" && (
          order.orderSource.toUpperCase().includes("QR") ||
          order.orderSource.toUpperCase().includes("ONLINE")
        ));

      if (isNewOrder) {
        seenLiveOrderIdsRef.current.add(orderIdStr);
        seenOrderItemCountsRef.current.set(orderIdStr, currentItemCount);

        if (!printedLiveOrderIdsRef.current.has(orderIdStr)) {
          printedLiveOrderIdsRef.current.add(orderIdStr);

          // Save to sessionStorage
          try {
            sessionStorage.setItem(
              "pos_auto_printed_order_ids",
              JSON.stringify(Array.from(printedLiveOrderIdsRef.current))
            );
          } catch {}

          const tableDisplay = order.table?.number ? `Table ${order.table.number}` : "";
          const tokenDisplay = order.tokenNumber ? `#${order.tokenNumber}` : "";
          const resolvedServerName =
            order.waiterName || (isOnlineOrQr ? "Online QR" : "Captain");

          // Only auto-print if order is from Online / QR (pos-user)
          if (isOnlineOrQr) {
            // 1. AUTO-PRINT KOT / STATION TICKET TO KITCHEN PRINTER
            if (stationPrinter) {
              try {
                const kotOrder: KotOrder = {
                  orderNumber:
                    order.orderNumber || String(order._id).slice(-4).toUpperCase(),
                  tokenNumber: order.tokenNumber,
                  orderType: order.orderType || "DineIn",
                  table: order.table ? { number: order.table.number } : null,
                  serverName: resolvedServerName,
                  waiterName: resolvedServerName,
                  guestCount: order.membersOnTable,
                  customerName: order.customerName,
                  customerPhone: order.customerPhone,
                  stationName: "Kitchen",
                  createdAt: order.createdAt || Date.now(),
                  firedAt: Date.now(),
                  specialNotes: order.specialNotes,
                  items: (order.items || []).map((it: any) => ({
                    itemName: it.itemName || it.name,
                    quantity: it.quantity,
                    itemPrice: it.itemPrice || it.price,
                    customizations: it.customizations?.map((c: any) => ({
                      optionName: c.name || c.optionName,
                    })),
                    notes: it.notes,
                  })),
                };

                const kotStr = generateDefxKotPlainString(kotOrder, getFlag, 48);
                printThermalReceiptDocument(
                  kotStr,
                  `KOT - Token #${order.tokenNumber || ""}`,
                  {
                    printerType: stationPrinter.printerType,
                    printerUrl: stationPrinter.printerUrl,
                    printerPort: stationPrinter.printerPort,
                    stationId: stationPrinter.stationId,
                    silent: true,
                  }
                ).catch((e) => console.warn("Global Auto-print KOT failed:", e));
              } catch (kotErr) {
                console.warn("Global Auto-print KOT generation error:", kotErr);
              }
            }

            // 2. AUTO-PRINT WORKSTATION / RUNNER SLIP
            if (workstationPrinter) {
              try {
                const runnerOrder = {
                  orderNumber:
                    order.orderNumber || String(order._id).slice(-4).toUpperCase(),
                  tokenNumber: order.tokenNumber,
                  orderType: order.orderType || "DineIn",
                  table: order.table ? { number: order.table.number } : undefined,
                  tableName: order.table?.number,
                  waiterName: resolvedServerName,
                  serverName: resolvedServerName,
                  customerName: order.customerName,
                  customerPhone: order.customerPhone,
                  createdAt: order.createdAt || Date.now(),
                  specialNotes: order.specialNotes,
                  items: (order.items || []).map((it: any) => ({
                    itemName: it.itemName || it.name,
                    name: it.name || it.itemName,
                    quantity: it.quantity,
                    customizations: it.customizations,
                    notes: it.notes,
                  })),
                };

                const slipStr = generateWorkstationRunnerSlipPlainString(
                  runnerOrder,
                  activeOrg,
                  48
                );

                setTimeout(() => {
                  printThermalReceiptDocument(
                    slipStr,
                    `Runner Slip - Token #${order.tokenNumber || ""}`,
                    {
                      printerType: workstationPrinter.printerType,
                      printerUrl: workstationPrinter.printerUrl,
                      printerPort: workstationPrinter.printerPort,
                      stationId: workstationPrinter.stationId,
                      silent: true,
                    }
                  ).catch((e) => console.warn("Global Auto-print Runner slip failed:", e));
                }, 800);
              } catch (slipErr) {
                console.warn("Global Auto-print Runner slip generation error:", slipErr);
              }
            }

            showToast(`🖨️ Auto-printed KOT & Runner Slip for Online QR Order (${tokenDisplay || tableDisplay})`);
          }
        }
      } else if (currentItemCount > prevItemCount) {
        seenOrderItemCountsRef.current.set(orderIdStr, currentItemCount);
      }
    }
  }, [liveOrders, activeOrg, orgFeatures, printers]);

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-neutral-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-neutral-700 animate-slide-up">
      <span className="material-symbols-outlined text-green-400 text-xl">print</span>
      <span className="text-sm font-medium">{toastMessage}</span>
      <button
        onClick={() => setToastMessage(null)}
        className="ml-2 text-neutral-400 hover:text-white"
        aria-label="Dismiss"
      >
        <span className="material-symbols-outlined text-sm">close</span>
      </button>
    </div>
  );
}
