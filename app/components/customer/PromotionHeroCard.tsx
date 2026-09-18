"use client";

import React, { useState, useEffect } from "react";
import { ArrowForwardIcon } from "./CustomerIcons";

interface PromotionSlide {
  _id?: string;
  imageUrl?: string | null;
  badge?: string;
  title?: string;
  description?: string;
}

interface PromotionHeroCardProps {
  slides?: Array<{
    _id: string;
    imageUrl?: string | null;
    fileName?: string;
    position?: number;
  }>;
  onExploreSpecials?: () => void;
}

const DEFAULT_SLIDES: PromotionSlide[] = [
  {
    badge: "Chef's Signature",
    title: "Artisanal Bao & Dim Sum Series",
    description: "Handcrafted delicacies rolled and prepared fresh to your table.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBThwnh6frApdcilo7XB_Ii0oisDHiKCVns7pZbhVQNEqWvBA-5D7HCmaHHBzZzbBV6SiToOZic4nNtc355WvQILmVWg-_PMwmqTLEC44WNKyuHvBq2GH5YKiYfA4dgAM5xiuQ9kNxcZ-J-93KzJckaL9BWoOeWTRv96OHWZgYw95WeTl4fmX21gf3VoX1r14vboDbLdnsayIUv6dUcvuCU6aSMEBQJW6SPu49yVI5AVYzKookvYFoXgQ",
  },
  {
    badge: "Trending Today",
    title: "Crispy Dumplings & Steamed Lotus Buns",
    description: "Savor our freshly crafted gourmet dim sum selection.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDa4aAuZCoS9KksZ3ZJOKBckCu5x3mGmPtTyJIQ3TgiOdYuOxy9MpDK_WS6CmcSrgCYDcal5pV3_Dis_AD5ePBhHOysZPgI_dLcqfvQ0Go-AEFGoc46gHzwjL1I_UjffalAF2cMazCYq8Eiq_MT6tEQMXT5pR_AFMKP1K3K64h38toEH8ym7VOcqhZaogmJqtqguW9WOlvjz000V8KLYSU5akkXjlW3CHKWRfWIfUb2mSuOEsvZlMzHnw",
  },
  {
    badge: "Barista Special",
    title: "Cold Brews & Artisanal Sips",
    description: "Slow dripped 18-hour brewed coffee paired with delicious bites.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDWdXlOFjycMfdbmYNC7YUe1B4fBsrWJdn7kWWzt2YDZW-_v3ZFuzyVU6uKymjyNxFqSFLZT3kQQfrEQ_fpjWnLPgqiFRwWKqqEgRGytU8DLCBMTgLl2Y8ibGmVyDDp_Dp8CEV7wOnr82ABMiTIZYNZ2BQ_nTHkV_1Y9WJBwaZU7Dcgd04PnP2Qy9sz6Gx3VM_bHq4T3f4tlrk1xxe-FgQAahTMi9J2e3EJsrpAITJIYKktrsHrXwwA6w",
  },
];

export function PromotionHeroCard({ slides, onExploreSpecials }: PromotionHeroCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const effectiveSlides: PromotionSlide[] =
    slides && slides.length > 0 && slides.some((s) => !!s.imageUrl)
      ? slides.map((s, idx) => ({
          _id: s._id,
          imageUrl: s.imageUrl || DEFAULT_SLIDES[idx % DEFAULT_SLIDES.length].imageUrl,
          badge: idx === 0 ? "Chef's Signature" : "Special Feature",
          title: s.fileName ? s.fileName.replace(/\.[^/.]+$/, "") : DEFAULT_SLIDES[idx % DEFAULT_SLIDES.length].title,
          description: DEFAULT_SLIDES[idx % DEFAULT_SLIDES.length].description,
        }))
      : DEFAULT_SLIDES;

  const currentSlide = effectiveSlides[activeIndex] || DEFAULT_SLIDES[0];

  // Auto rotate every 6 seconds
  useEffect(() => {
    if (effectiveSlides.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % effectiveSlides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [effectiveSlides.length]);

  return (
    <section className="relative w-full rounded-2xl overflow-hidden bg-stone-900 shadow-sm">
      <div
        className="relative h-48 w-full bg-cover bg-center transition-all duration-700 ease-in-out"
        style={{
          backgroundImage: `url("${currentSlide.imageUrl || DEFAULT_SLIDES[0].imageUrl}")`,
        }}
      >
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#131b2e]/95 via-[#131b2e]/45 to-transparent" />

        {/* Top Tag Badge */}
        <div className="absolute top-3.5 left-3.5">
          <span className="bg-[#4338ca] text-white text-[11px] px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold shadow-xs">
            {currentSlide.badge || "Chef's Signature"}
          </span>
        </div>

        {/* Bottom Content Area */}
        <div className="absolute bottom-3.5 inset-x-3.5 flex flex-col gap-1 text-white">
          <h2 className="text-lg font-bold leading-snug tracking-tight text-white drop-shadow-xs">
            {currentSlide.title}
          </h2>
          <p className="text-xs opacity-90 line-clamp-1 text-stone-200">
            {currentSlide.description}
          </p>

          <div className="flex items-center justify-between pt-1.5">
            <button
              type="button"
              onClick={onExploreSpecials}
              className="inline-flex items-center gap-1 text-white bg-[#4338ca] hover:bg-[#372abf] active:scale-95 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs"
            >
              <span>Explore Specials</span>
              <ArrowForwardIcon className="w-3.5 h-3.5" />
            </button>

            {/* Carousel Indicators */}
            {effectiveSlides.length > 1 && (
              <div className="flex items-center gap-1">
                {effectiveSlides.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`Slide ${idx + 1}`}
                    onClick={() => setActiveIndex(idx)}
                    className={`transition-all ${
                      idx === activeIndex
                        ? "w-3 h-1.5 rounded-full bg-[#c3c0ff]"
                        : "w-1.5 h-1.5 rounded-full bg-white/40 hover:bg-white/70"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
