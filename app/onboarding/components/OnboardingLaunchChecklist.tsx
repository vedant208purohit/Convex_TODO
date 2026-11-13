"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Id } from "../../../convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface OnboardingLaunchChecklistProps {
  organizationId?: Id<"organizations">;
  orgName: string;
  restName: string;
  userFullName?: string;
}

export function OnboardingLaunchChecklist({
  organizationId,
  orgName,
  restName,
  userFullName,
}: OnboardingLaunchChecklistProps) {
  const router = useRouter();
  const updateChecklistMutation = useMutation(api.organizations.updateOnboardingChecklist);

  // Read stored checklist state from organization
  const orgData = useQuery(api.organizations.list);
  const currentOrg = orgData?.find((o) => o && o._id === organizationId) || (orgData && orgData[0]);
  const effectiveOrgId = organizationId || currentOrg?._id;

  // Queries to auto-detect setup readiness
  const menus = useQuery(
    api.menu.listMenus,
    effectiveOrgId ? { organizationId: effectiveOrgId } : "skip"
  );
  const storeMenu = useQuery(
    api.menu.getOrganizationMenu,
    effectiveOrgId ? { organizationId: effectiveOrgId, allMenus: true } : "skip"
  );
  const tables = useQuery(api.organizationTables.list, {});
  const stations = useQuery(
    api.stations.list,
    effectiveOrgId ? { organizationId: effectiveOrgId, includeSummary: true } : "skip"
  );
  const members = useQuery(
    api.organizationUsers.list,
    effectiveOrgId ? { organizationId: effectiveOrgId } : "skip"
  );
  const paymentModes = useQuery(
    api.paymentModes.list,
    effectiveOrgId ? { organizationId: effectiveOrgId } : "skip"
  );
  const taxComponents = useQuery(
    api.taxation.listTaxComponents,
    effectiveOrgId ? { organizationId: effectiveOrgId } : "skip"
  );

  const [isBannerVisible, setIsBannerVisible] = useState(true);
  const [manualCompletedIds, setManualCompletedIds] = useState<number[]>([]);

  useEffect(() => {
    if (currentOrg?.onboardingChecklist) {
      setManualCompletedIds(currentOrg.onboardingChecklist);
    }
    if (currentOrg?.onboardingDismissedBanner !== undefined) {
      setIsBannerVisible(!currentOrg.onboardingDismissedBanner);
    }
  }, [currentOrg?.onboardingChecklist, currentOrg?.onboardingDismissedBanner]);

  const isItemCompleted = (id: number): boolean => {
    // 1. Manual check always takes precedence
    if (manualCompletedIds.includes(id)) return true;

    // 2. Automated detection based on active store data:
    // Item 1: Add your menu -> auto-completes if menus, categories, or items exist
    if (id === 1) {
      if (menus && menus.length > 0) return true;
      if (storeMenu && Array.isArray(storeMenu) && storeMenu.length > 0) return true;
    }
    // Item 2: Configure taxes -> auto-completes if tax components are configured
    if (id === 2 && taxComponents && taxComponents.length > 0) return true;
    // Item 3: Connect payment methods -> auto-completes if active payment modes exist
    if (id === 3 && paymentModes && paymentModes.length > 0) return true;
    // Item 4: Set up tables -> auto-completes if custom tables exist
    if (id === 4 && tables && tables.length > 0) {
      // If tables are present and belongs to current store
      return true;
    }
    // Item 5: Configure kitchen display -> auto-completes if stations exist
    if (id === 5 && stations && stations.length > 0) return true;
    // Item 6: Add employees -> auto-completes if staff members > 1
    if (id === 6 && members && members.length > 1) return true;

    return false;
  };

  const handleToggleItem = async (id: number) => {
    if (!currentOrg) return;
    const currentlyDone = manualCompletedIds.includes(id);
    const nextList = currentlyDone
      ? manualCompletedIds.filter((item) => item !== id)
      : [...new Set([...manualCompletedIds, id])];
    setManualCompletedIds(nextList);
    try {
      await updateChecklistMutation({
        id: currentOrg._id,
        completedItems: nextList,
      });
    } catch (e) {
      console.error("Failed to update checklist item:", e);
    }
  };

  const handleDismissBanner = async () => {
    setIsBannerVisible(false);
    if (currentOrg) {
      try {
        await updateChecklistMutation({
          id: currentOrg._id,
          dismissedBanner: true,
        });
      } catch (e) {
        console.error("Failed to dismiss banner:", e);
      }
    }
  };

  const handleScrollToSetup = () => {
    const el = document.getElementById("setup-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const activeTablesCount = tables ? tables.filter((t: any) => t.isOccupied).length : 0;
  const totalTablesCount = tables ? tables.length : 18;

  const CHECKLIST_ITEMS = [
    {
      id: 1,
      title: "1. Add your menu",
      badge: "Essential",
      badgeType: "essential",
      description: "Input signature appetizers, tasting mains, cellar wines, and artisan cocktails.",
      buttonLabel: "Add Menu Items",
      targetHref: "/menu",
    },
    {
      id: 2,
      title: "2. Configure taxes",
      badge: "Jurisdiction",
      badgeType: "jurisdiction",
      description: "Set standard state/local sales tax rate and beverage surcharges.",
      buttonLabel: "Review Taxes",
      targetHref: "/settings?tab=organization&subTab=taxation",
    },
    {
      id: 3,
      title: "3. Connect payment methods",
      badge: "Terminal Link",
      badgeType: "terminal",
      description: "Pair Bluetooth contactless readers, chip terminals, and tip gratuity parameters.",
      buttonLabel: "Set Up Payments",
      targetHref: "/settings?tab=payment",
    },
    {
      id: 4,
      title: "4. Set up tables",
      badge: "Floor Map",
      badgeType: "default",
      description: "Map dining room booths, bar stools, patio sections, and cover numbers.",
      buttonLabel: "Floorplan Editor",
      targetHref: "/settings?tab=tables",
    },
    {
      id: 5,
      title: "5. Configure kitchen display",
      badge: "KDS Routing",
      badgeType: "default",
      description: "Assign hot dishes to the grill line, cold plates to garde-manger, and cocktails to the service bar.",
      buttonLabel: "Route KDS",
      targetHref: "/kds",
    },
    {
      id: 6,
      title: "6. Add employees",
      badge: "Permissions",
      badgeType: "default",
      description: "Invite shift managers, head chefs, servers, and sommeliers with custom PIN passes.",
      buttonLabel: "Invite Staff",
      targetHref: "/settings?tab=staff",
    },
  ];

  const totalChecklist = CHECKLIST_ITEMS.length;
  const doneCount = CHECKLIST_ITEMS.filter((item) => isItemCompleted(item.id)).length;
  const percent = Math.round((doneCount / totalChecklist) * 100);

  // Formatted date
  const todayStr = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());

  const [navigating, setNavigating] = useState(false);

  const allCompleted = doneCount === CHECKLIST_ITEMS.length;

  const handleProceed = async () => {
    if (!allCompleted || !currentOrg) {
      return;
    }
    setNavigating(true);
    try {
      const completedIds = CHECKLIST_ITEMS.filter((item) => isItemCompleted(item.id)).map((item) => item.id);
      await updateChecklistMutation({
        id: currentOrg._id,
        completedItems: completedIds,
        markCompleted: true,
      });
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
      setNavigating(false);
    }
  };

  return (
    <div className="w-full max-w-4xl space-y-6 animate-in fade-in-50 duration-300">
      {/* Welcome Editorial Banner Card */}
      {isBannerVisible && (
        <div
          id="welcome-banner"
          className="relative overflow-hidden rounded-xl bg-white border border-[#eadfd6] shadow-xs p-6 md:p-8 transition-all duration-300"
        >
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 mb-1.5">
                <span className="text-[11px] uppercase tracking-widest text-[#645d58] font-semibold">
                  Platform Onboarding Completed
                </span>
                <span className="text-[#645d58]">•</span>
                <span className="text-[11px] font-medium text-[#645d58]">
                  {restName || "Your Restaurant"}
                </span>
              </div>
              <h1 className="font-serif text-2xl md:text-3xl font-normal text-[#1d1b1a] tracking-tight mb-2">
                Your restaurant is ready!
              </h1>
              <p className="text-xs md:text-sm text-[#4d4541] leading-relaxed">
                Welcome to PREST. Your bespoke dining workspace has been created for {restName || "your restaurant"}.
                Let&apos;s configure your catalog, dining room, and staff stations to start taking live table tickets.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2.5 self-start lg:self-center shrink-0">
              <button
                type="button"
                id="dismiss-banner-btn"
                onClick={handleDismissBanner}
                className="px-4 py-2 rounded-xl bg-[#f4ece8] hover:bg-[#ede7e4] text-[#4d4541] text-xs font-medium transition cursor-pointer"
              >
                Dismiss Banner
              </button>
              <button
                type="button"
                onClick={handleScrollToSetup}
                className="px-4 py-2 rounded-xl bg-[#1f1f1f] hover:bg-black text-white text-xs font-medium transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>Complete Checklist</span>
                <span className="material-symbols-outlined text-[15px]">arrow_downward</span>
              </button>
            </div>
          </div>
          {/* Subtle architectural background accent */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#f4ece8] to-transparent pointer-events-none opacity-40" />
        </div>
      )}

      {/* Operational Core: Checklist Section */}
      <section id="setup-section" className="flex flex-col space-y-4">
        {/* Section Header with Progress Ring */}
        <div className="bg-white rounded-xl p-5 md:p-6 border border-[#eadfd6] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] uppercase tracking-widest text-[#645d58] font-semibold">
                Getting Started
              </span>
              <span className="text-[#645d58]">•</span>
              <span className="text-[11px] font-semibold text-emerald-700">
                Setup Roadmap
              </span>
            </div>
            <h2 className="font-serif text-xl md:text-2xl text-[#1d1b1a]">
              Restaurant Launch Checklist
            </h2>
            <p className="text-xs md:text-sm text-[#7f7570] mt-0.5">
              Complete these operational prerequisites to finalize POS sync and shift handoff.
            </p>
          </div>

          {/* Live Visual Progress Ring & Score */}
          <div className="flex items-center gap-4 bg-[#faf2ee] px-4 py-2.5 rounded-xl border border-[#eadfd6] shrink-0 self-start md:self-auto">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[#eadfd6]"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.2"
                />
                <path
                  className="text-[#1f1f1f] transition-all duration-500 ease-out"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  id="progress-circle"
                  stroke="currentColor"
                  strokeDasharray={`${percent}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3.2"
                />
              </svg>
              <span className="absolute text-xs font-bold text-[#1d1b1a]" id="progress-percent">
                {percent}%
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold text-[#1d1b1a] leading-none" id="checklist-counter">
                {doneCount} of {totalChecklist}
              </span>
              <span className="text-xs text-[#7f7570] mt-0.5">completed</span>
            </div>
          </div>
        </div>

        {/* Checklist Interactive Cards */}
        <div className="space-y-2.5">
          {CHECKLIST_ITEMS.map((item) => {
            const completed = isItemCompleted(item.id);

            return (
              <div
                key={item.id}
                data-item-id={item.id}
                className={`bg-white hover:bg-[#fffdfc] rounded-xl p-4 md:p-5 border border-[#eadfd6] shadow-2xs transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  completed ? "opacity-75" : ""
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <button
                    type="button"
                    aria-label={`Mark task ${item.id} complete`}
                    onClick={() => handleToggleItem(item.id)}
                    className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                      completed
                        ? "bg-[#1f1f1f] text-white"
                        : "bg-[#f4ece8] text-[#7f7570] hover:text-[#1d1b1a] hover:bg-[#ede7e4]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  </button>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-sm md:text-base font-medium text-[#1d1b1a] ${
                          completed ? "line-through text-[#7f7570]" : ""
                        }`}
                      >
                        {item.title}
                      </h3>
                      {item.badgeType === "essential" && (
                        <span className="text-[10px] font-semibold bg-[#eae1da] text-[#6a635e] px-2 py-0.5 rounded">
                          {item.badge}
                        </span>
                      )}
                      {item.badgeType === "jurisdiction" && (
                        <span className="text-[10px] font-semibold bg-[#f4ece8] text-[#7f7570] px-2 py-0.5 rounded">
                          {item.badge}
                        </span>
                      )}
                      {item.badgeType === "terminal" && (
                        <span className="text-[10px] font-semibold bg-[#eae1da] text-[#6a635e] px-2 py-0.5 rounded">
                          {item.badge}
                        </span>
                      )}
                      {item.badgeType === "default" && (
                        <span className="text-[10px] font-semibold bg-[#f4ece8] text-[#7f7570] px-2 py-0.5 rounded">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#7f7570] mt-1">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-9 sm:pl-0 shrink-0">
                  <Link
                    href={item.targetHref}
                    className="px-3.5 py-1.5 rounded-xl bg-[#f4ece8] hover:bg-[#ede7e4] text-[#1d1b1a] text-xs font-medium transition inline-flex items-center gap-1 cursor-pointer border border-[#eadfd6]"
                  >
                    <span>{item.buttonLabel}</span>
                    <span className="material-symbols-outlined text-[15px]">chevron_right</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Navigation to Dashboard */}
        <div className="pt-6 flex justify-end">
          <button
            type="button"
            disabled={!allCompleted || navigating}
            onClick={handleProceed}
            className={`px-6 py-3 rounded-lg text-sm font-medium transition shadow-md flex items-center gap-2 ${
              allCompleted
                ? "bg-[#1f1f1f] hover:bg-black text-white cursor-pointer"
                : "bg-[#e5e2e1] text-[#888686] cursor-not-allowed opacity-60"
            }`}
          >
            <span>{navigating ? "Entering Dashboard..." : "Proceed to Dashboard Studio"}</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      </section>
    </div>
  );
}

