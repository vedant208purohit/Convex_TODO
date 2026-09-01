"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function DigitalMenuCatalog() {
  const organizations = useQuery(api.organizations.list);
  const organization = organizations?.[0] ?? null;
  const organizationId = organization?._id;

  const menuData = useQuery(
    api.menu.getOrganizationMenu,
    organizationId ? { organizationId } : "skip"
  );

  const [currentLang, setCurrentLang] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pos_selected_language") || "en";
    }
    return "en";
  });

  useEffect(() => {
    const handleLangChange = (e: Event) => {
      const customEvt = e as CustomEvent<{ code: string }>;
      if (customEvt.detail?.code) {
        setCurrentLang(customEvt.detail.code);
      }
    };
    window.addEventListener("pos_language_change", handleLangChange);
    return () => window.removeEventListener("pos_language_change", handleLangChange);
  }, []);

  const getLocalizedCategoryName = (category: {
    name: string;
    name_hi?: string;
    name_gu?: string;
    [key: string]: any;
  }) => {
    const code = currentLang.toLowerCase();
    if (code === "hi" && category.name_hi?.trim()) {
      return category.name_hi;
    }
    if (code === "gu" && category.name_gu?.trim()) {
      return category.name_gu;
    }
    const dynamicKey = `name_${code}`;
    if (category[dynamicKey] && typeof category[dynamicKey] === "string" && category[dynamicKey].trim()) {
      return category[dynamicKey];
    }
    return category.name;
  };

  const getLocalizedItemName = (item: {
    name: string;
    [key: string]: any;
  }) => {
    const code = currentLang.toLowerCase();
    const dynamicKey = `name_${code}`;
    if (item[dynamicKey] && typeof item[dynamicKey] === "string" && item[dynamicKey].trim()) {
      return item[dynamicKey];
    }
    return item.name;
  };

  if (menuData === undefined && organizationId) {
    return (
      <div className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6 text-center text-sm text-[#6f655e]">
        Loading menu catalog...
      </div>
    );
  }

  // Fallback demo items if no database menu items are provisioned yet
  const demoCategories = [
    {
      id: "demo-cat-1",
      name: "Main Course",
      name_hi: "मुख्य व्यंजन (Main Course)",
      name_gu: "મુખ્ય વાનગીઓ (Main Course)",
      items: [
        { id: "item-1", name: "Truffle Burger", price: "$18.00", description: "Gourmet beef patty with black truffle mayo" },
        { id: "item-2", name: "Paneer Butter Masala", price: "$14.50", description: "Cottage cheese in rich tomato gravy" },
      ],
    },
    {
      id: "demo-cat-2",
      name: "Beverages",
      name_hi: "पेय पदार्थ (Beverages)",
      name_gu: "પીણાં (Beverages)",
      items: [
        { id: "item-3", name: "Cold Coffee", price: "$5.00", description: "Chilled espresso with creamy milk" },
        { id: "item-4", name: "Mango Lassi", price: "$4.50", description: "Traditional sweet mango yogurt drink" },
      ],
    },
  ];

  const categoriesToRender =
    menuData && menuData.length > 0
      ? menuData.map((group: any) => ({
          id: group.category.id,
          name: group.category.name,
          name_hi: group.category.name_hi,
          name_gu: group.category.name_gu,
          items: group.category.items.map((i: any) => ({
            id: i.item.id,
            name: i.item.name,
            price: `$${i.item.display_price}`,
            description: i.item.description || "",
          })),
        }))
      : demoCategories;

  return (
    <div className="rounded-3xl border border-[#eadfd6] bg-[#fbf7f4] p-6">
      <div className="flex items-center justify-between border-b border-[#eadfd6] pb-4">
        <div>
          <h2 className="text-lg font-medium text-[#1f1a17]">Digital Menu Catalog</h2>
          <p className="mt-0.5 text-xs text-[#6f655e]">
            Live multi-language menu rendering • Active language:{" "}
            <span className="font-semibold uppercase text-[#1f1a17]">{currentLang}</span>
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
          Localized Active
        </span>
      </div>

      <div className="mt-5 space-y-6">
        {categoriesToRender.map((cat: any) => (
          <div key={cat.id} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#8a7e75] flex items-center gap-2">
              <span>{getLocalizedCategoryName(cat)}</span>
              {currentLang !== "en" && (
                <span className="text-[10px] font-normal normal-case text-[#8a7e75]">
                  ({cat.name})
                </span>
              )}
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              {cat.items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between rounded-2xl border border-[#eadfd6] bg-white p-4 shadow-sm"
                >
                  <div>
                    <div className="font-medium text-sm text-[#1f1a17]">
                      {getLocalizedItemName(item)}
                    </div>
                    {item.description ? (
                      <div className="mt-1 text-xs text-[#6f655e] line-clamp-2">
                        {item.description}
                      </div>
                    ) : null}
                  </div>
                  <div className="font-medium text-sm text-[#1f1a17] ml-3 shrink-0">
                    {item.price}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
