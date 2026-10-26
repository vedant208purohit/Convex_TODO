/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../../convex/_generated/api";

interface CartLineItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customizations?: Array<{
    groupName: string;
    optionName: string;
    price: number;
  }>;
  notes?: string;
}

interface FrontDisplaySessionPayload {
  organizationId?: string;
  storeName?: string;
  terminalId?: string;
  cashierName?: string;
  state: "idle" | "ringing" | "payment_qr" | "cash_tender" | "completed";
  orderNumber?: string;
  tokenNumber?: string;
  tableNumber?: string;
  customer?: {
    name?: string;
    phone?: string;
    loyaltyPoints?: number;
  };
  cartItems?: CartLineItem[];
  totals?: {
    subTotal: number;
    discountAmount: number;
    taxTotal: number;
    deliveryCharge: number;
    totalAmount: number;
  };
  payment?: {
    mode: "UPI" | "Cash" | "Card" | "Other";
    dynamicQrString?: string;
    qrImageUrl?: string;
    tenderedAmount?: number;
    changeDue?: number;
    status: "Pending" | "Paid" | "Failed";
  };
  survey?: {
    surveyId?: string;
    questionText?: string;
  };
  timestamp?: number;
}

function FrontDisplayContent() {
  const searchParams = useSearchParams();
  const terminalId = searchParams.get("terminalId") || "terminal-01";

  // 1. Resolve Store Organization
  const organizations = useQuery(api.organizations.list);
  const activeOrg = useMemo(() => {
    if (!organizations || organizations.length === 0) return null;
    return organizations[0];
  }, [organizations]);

  // 2. Load Persisted CFD Settings
  const cfdSettings = useQuery(api.frontDisplay.getSettings, {
    organizationId: activeOrg?._id,
  });

  // 3. Load Active Carousel Slides
  const carouselScreens = useQuery(api.organizationCarouselScreens.listPublic) || [];

  // 4. Load Active Survey
  const activeSurvey = useQuery(api.frontDisplay.getActiveSurvey);

  // 5. Cloud Session Subscription
  const cloudSession = useQuery(api.frontDisplay.getSessionState, {
    terminalId,
    organizationId: activeOrg?._id,
  });

  // Mutations
  const submitRatingMutation = useMutation(api.frontDisplay.submitInstantRating);

  // Local Display State
  const [session, setSession] = useState<FrontDisplaySessionPayload>({
    state: "idle",
  });
  const [liveSettings, setLiveSettings] = useState<{
    cfdEnabled?: boolean;
    displayLayout?: "split" | "cart" | "media";
    theme?: "light" | "dark" | "warm";
    showPaymentQr?: boolean;
    storeUpiAddress?: string;
    showCashTenderedChangeDue?: boolean;
    merchantDisplayName?: string;
    showStarRatingSurvey?: boolean;
    showWhatsappReceipt?: boolean;
    returnToWelcomeTimeout?: number;
  } | null>(null);

  // Synchronize when Convex query updates
  useEffect(() => {
    if (cfdSettings) {
      setLiveSettings((prev) => ({
        ...cfdSettings,
        ...prev,
        displayLayout: prev?.displayLayout ?? cfdSettings.displayLayout,
        theme: prev?.theme ?? cfdSettings.theme,
      }));
    }
  }, [cfdSettings]);

  const effectiveSettings = liveSettings || cfdSettings;

  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ratingScore, setRatingScore] = useState<number | null>(null);
  const [isRatingSubmitted, setIsRatingSubmitted] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [isReceiptSent, setIsReceiptSent] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Sample slides fallback
  const sampleFallbackSlides = [
    {
      _id: "s1",
      imageUrl:
        "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1440&q=80",
      fileName: "Signature Tasting Menu Autumn 2026",
    },
    {
      _id: "s2",
      imageUrl:
        "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1440&q=80",
      fileName: "Sommelier Reserve Cellar Selection",
    },
    {
      _id: "s3",
      imageUrl:
        "https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=1440&q=80",
      fileName: "Pastry & Dolce Tasting Course",
    },
  ];

  const activeSlides =
    carouselScreens.length > 0 ? carouselScreens : sampleFallbackSlides;

  // 1. Zero-latency BroadcastChannel listener
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("pos_front_display_channel");
      channel.onmessage = (event) => {
        if (event.data && typeof event.data === "object") {
          if (event.data.type === "cfd_settings_update" && event.data.settings) {
            setLiveSettings((prev) => ({
              ...(prev || {}),
              ...event.data.settings,
            }));
          } else {
            setSession(event.data);
          }
        }
      };
    } catch (e) {
      console.warn("BroadcastChannel not supported or error:", e);
    }

    return () => {
      channel?.close();
    };
  }, []);

  // 2. Synchronize with Cloud Session when present
  useEffect(() => {
    if (cloudSession && cloudSession.payload) {
      setSession({
        state: cloudSession.state,
        ...cloudSession.payload,
      });
    }
  }, [cloudSession]);

  // 3. Promotional Carousel Rotation Interval
  useEffect(() => {
    if (activeSlides.length <= 1) return;
    const interval = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % activeSlides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeSlides.length]);

  // 4. Auto-Return Countdown on Completion State
  useEffect(() => {
    if (session.state === "completed") {
      const timeout = cfdSettings?.returnToWelcomeTimeout || 8;
      setCountdown(timeout);

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            setSession({ state: "idle" });
            setIsRatingSubmitted(false);
            setRatingScore(null);
            setIsReceiptSent(false);
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setCountdown(null);
    }
  }, [session.state, cfdSettings?.returnToWelcomeTimeout]);

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Submit Rating
  const handleRating = async (score: number) => {
    setRatingScore(score);
    setIsRatingSubmitted(true);
    try {
      await submitRatingMutation({
        score,
        orderNumber: session.orderNumber,
        surveyId: activeSurvey?._id,
        organizationId: activeOrg?._id,
      });
    } catch (err) {
      console.error("Rating error:", err);
    }
  };

  // Send WhatsApp Receipt
  const handleSendReceipt = () => {
    if (!whatsappPhone || whatsappPhone.length < 10) {
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }
    setIsReceiptSent(true);
  };

  // Styling based on Theme
  type ThemeKey = "light" | "dark" | "warm";
  const themeMode: ThemeKey =
    effectiveSettings?.theme === "dark" || effectiveSettings?.theme === "warm"
      ? effectiveSettings.theme
      : "light";
  const layoutMode = effectiveSettings?.displayLayout || "split";

  const themeStyles = {
    light: {
      bg: "bg-[#fff8f5]",
      card: "bg-white",
      text: "text-[#1e1b19]",
      subtext: "text-[#645d58]",
      border: "border-[#e9e1dd]",
      accent: "bg-black text-white",
      highlight: "bg-[#faf2ee]",
      titleText: "text-[#1e1b19]",
      summaryBg: "bg-[#faf2ee]",
      emptyIcon: "text-stone-300",
      emptyTitle: "text-stone-800",
      emptySubtitle: "text-stone-500",
      qrCard: "bg-white border-[#e9e1dd]",
      tokenBox: "bg-white border-black text-black",
      feedbackCard: "bg-white border-[#e9e1dd]",
      receiptCard: "bg-[#faf2ee] border-[#e9e1dd]",
      inputBg: "bg-white border-[#d0c4be] text-black",
    },
    dark: {
      bg: "bg-[#141211]",
      card: "bg-[#1e1b19]",
      text: "text-[#f7efeb]",
      subtext: "text-[#a89f9b]",
      border: "border-[#33302d]",
      accent: "bg-white text-black",
      highlight: "bg-[#282523]",
      titleText: "text-white",
      summaryBg: "bg-[#181614]",
      emptyIcon: "text-stone-600",
      emptyTitle: "text-white",
      emptySubtitle: "text-stone-300",
      qrCard: "bg-[#24201e] border-[#3a3532]",
      tokenBox: "bg-[#24201e] border-[#4a4440] text-white",
      feedbackCard: "bg-[#1e1b19] border-[#33302d]",
      receiptCard: "bg-[#181614] border-[#33302d]",
      inputBg: "bg-[#282523] border-[#4a4440] text-white",
    },
    warm: {
      bg: "bg-[#fff5ee]",
      card: "bg-white",
      text: "text-[#2e1d13]",
      subtext: "text-[#7a5c4d]",
      border: "border-[#fed7c3]",
      accent: "bg-[#cf6721] text-white",
      highlight: "bg-[#ffede2]",
      titleText: "text-[#2e1d13]",
      summaryBg: "bg-[#ffede2]",
      emptyIcon: "text-amber-200",
      emptyTitle: "text-[#2e1d13]",
      emptySubtitle: "text-[#7a5c4d]",
      qrCard: "bg-white border-[#fed7c3]",
      tokenBox: "bg-white border-[#cf6721] text-[#2e1d13]",
      feedbackCard: "bg-white border-[#fed7c3]",
      receiptCard: "bg-[#ffede2] border-[#fed7c3]",
      inputBg: "bg-white border-[#fed7c3] text-[#2e1d13]",
    },
  }[themeMode];

  // Current Slide
  const currentSlide = activeSlides[carouselIndex] || activeSlides[0];

  // Amounts format helper
  const formatCurrency = (amountPaise?: number) => {
    if (typeof amountPaise !== "number") return "₹ 0.00";
    return `₹ ${(amountPaise / 100).toFixed(2)}`;
  };

  // If CFD is disabled by master setting
  if (effectiveSettings?.cfdEnabled === false) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#141211] text-white p-6 text-center">
        <span className="material-symbols-outlined text-[48px] text-[#ffdbca] mb-3">
          tv_off
        </span>
        <h2 className="font-garamond text-3xl font-medium">
          Customer Display Standby
        </h2>
        <p className="text-stone-400 text-sm max-w-sm mt-1">
          This secondary screen is currently paused by store administration.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`w-screen h-screen ${themeStyles.bg} ${themeStyles.text} flex flex-col overflow-hidden select-none font-sans relative`}
    >
      {/* Top Brand Bar */}
      <header
        className={`h-16 ${themeStyles.card} border-b ${themeStyles.border} px-8 flex items-center justify-between shrink-0 shadow-2xs z-30`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full ${themeStyles.accent} flex items-center justify-center font-garamond text-lg font-bold`}>
            P
          </div>
          <div>
            <h1 className={`font-garamond text-xl font-semibold tracking-wide leading-none ${themeStyles.titleText}`}>
              {effectiveSettings?.merchantDisplayName ||
                activeOrg?.name ||
                "Skyz Restaurant & Banquet"}
            </h1>
            <span className={`text-[11px] ${themeStyles.subtext}`}>
              {session.orderNumber
                ? `Order #${session.orderNumber}`
                : "Welcome • Table Service & Takeaway"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {session.state === "completed" && countdown !== null && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              Returning in {countdown}s
            </span>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className={`p-2 rounded-full hover:${themeStyles.highlight} transition-colors cursor-pointer text-stone-400 hover:${themeStyles.titleText}`}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            <span className="material-symbols-outlined text-[20px]">
              {isFullscreen ? "fullscreen_exit" : "fullscreen"}
            </span>
          </button>
        </div>
      </header>

      {/* Main Screen Body */}
      <main className="flex-1 w-full h-[calc(100vh-64px)] overflow-hidden relative">
        {/* VIEW TYPE 1: MEDIA ONLY (Full-Screen Promotional Slideshow) */}
        {session.state !== "completed" && layoutMode === "media" && (
          <div className="w-full h-full relative overflow-hidden flex items-center justify-center bg-black">
            <img
              src={currentSlide.imageUrl || ""}
              alt={currentSlide.fileName || "Promotional Slide"}
              className="w-full h-full object-cover transition-opacity duration-1000"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40"></div>

            {/* Slide Caption Overlay */}
            <div className="absolute bottom-10 left-10 right-10 flex items-end justify-between text-white">
              <div className="max-w-xl">
                <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-semibold uppercase tracking-wider mb-2 inline-block">
                  Featured Promotion
                </span>
                <h2 className="font-garamond text-3xl lg:text-4xl font-normal leading-tight">
                  {currentSlide.fileName || "Chef's Autumn Tasting Specials"}
                </h2>
                <p className="text-white/80 text-sm mt-1">
                  Fresh, handcrafted seasonal dishes prepared to order.
                </p>
              </div>

              {/* Slide indicators */}
              <div className="flex items-center gap-2">
                {activeSlides.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      i === carouselIndex
                        ? "w-8 bg-white"
                        : "w-2 bg-white/40"
                    }`}
                  ></div>
                ))}
              </div>
            </div>

            {/* Floating QR on Media Only screen when in Payment QR state */}
            {session.state === "payment_qr" && effectiveSettings?.showPaymentQr && (
              <div className={`absolute top-8 right-8 z-20 ${themeStyles.qrCard} backdrop-blur-md rounded-2xl p-5 shadow-2xl border flex items-center gap-4`}>
                <div className="p-2 bg-white rounded-xl shadow-xs border border-stone-200">
                  <QRCodeSVG
                    value={
                      session.payment?.dynamicQrString ||
                      `upi://pay?pa=${encodeURIComponent(
                        effectiveSettings?.storeUpiAddress || "skyz.banquet@icici"
                      )}&pn=${encodeURIComponent(
                        effectiveSettings?.merchantDisplayName || "Skyz Restaurant"
                      )}&am=${((session.totals?.totalAmount || 0) / 100).toFixed(
                        2
                      )}&cu=INR`
                    }
                    size={110}
                    level="M"
                  />
                </div>
                <div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider inline-block">
                    Scan &amp; Pay
                  </span>
                  <div className={`font-garamond text-2xl font-bold mt-0.5 ${themeStyles.titleText}`}>
                    {formatCurrency(session.totals?.totalAmount)}
                  </div>
                  <span className={`text-[11px] ${themeStyles.subtext} block mt-0.5`}>
                    Instant UPI QR
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW TYPE 2 & 3: SPLIT VIEW OR FULL CART VIEW */}
        {session.state !== "completed" && layoutMode !== "media" && (
          <div className="w-full h-full flex flex-col lg:flex-row overflow-hidden">
            {/* Left Promotional Media Pane (ONLY rendered when layoutMode === "split") */}
            {layoutMode === "split" && (
              <div className="w-full lg:w-[42%] h-full relative overflow-hidden bg-black shrink-0 hidden md:block">
                <img
                  src={currentSlide.imageUrl || ""}
                  alt={currentSlide.fileName || "Promotion"}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30"></div>
                <div className="absolute bottom-8 left-8 right-8 text-white">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-semibold uppercase tracking-wider mb-2 inline-block">
                    Today&apos;s Special
                  </span>
                  <h3 className="font-garamond text-2xl font-normal leading-snug">
                    {currentSlide.fileName || "Artisanal Tasting Course"}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-3">
                    {activeSlides.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 rounded-full transition-all duration-300 ${
                          i === carouselIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"
                        }`}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Right Live Itemized Bill Mirror (or Full Width when layoutMode === "cart") */}
            <div
              className={`flex-1 h-full flex flex-col justify-between ${themeStyles.card} overflow-hidden`}
            >
              {/* Cart Items Header */}
              <div
                className={`p-6 border-b ${themeStyles.border} flex items-center justify-between shrink-0`}
              >
                <div>
                  <h2 className={`font-garamond text-2xl font-medium ${themeStyles.titleText}`}>
                    Current Order Summary
                  </h2>
                  <span className={`text-xs ${themeStyles.subtext}`}>
                    {session.tableNumber
                      ? `Table ${session.tableNumber} • `
                      : ""}
                    {session.cartItems?.length || 0} items ringing
                  </span>
                </div>

                {session.customer?.name && (
                  <div className="text-right">
                    <span className={`text-xs font-semibold ${themeStyles.titleText} block`}>
                      Guest: {session.customer.name}
                    </span>
                    {session.customer.loyaltyPoints !== undefined && (
                      <span className="text-[11px] text-emerald-500 font-medium">
                        ★ {session.customer.loyaltyPoints} Reward Points
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Scrollable Itemized List or Welcoming Ready State */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {session.cartItems && session.cartItems.length > 0 ? (
                  session.cartItems.map((item, idx) => (
                    <div
                      key={item.itemId || idx}
                      className={`flex items-start justify-between p-3.5 rounded-xl ${themeStyles.highlight} border ${themeStyles.border} transition-all`}
                    >
                      <div className="space-y-0.5 max-w-[70%]">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full ${themeStyles.accent} text-[10px] font-bold flex items-center justify-center shrink-0`}>
                            {item.quantity}x
                          </span>
                          <span className={`text-sm font-semibold ${themeStyles.titleText}`}>
                            {item.name}
                          </span>
                        </div>

                        {/* Modifiers & Customizations */}
                        {item.customizations && item.customizations.length > 0 && (
                          <div className="pl-7 space-y-0.5">
                            {item.customizations.map((mod, mIdx) => (
                              <span
                                key={mIdx}
                                className={`text-[11.5px] ${themeStyles.subtext} block italic`}
                              >
                                • {mod.groupName}: {mod.optionName}
                              </span>
                            ))}
                          </div>
                        )}

                        {item.notes && (
                          <p className="pl-7 text-[11px] text-amber-500 italic">
                            Note: {item.notes}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <span className={`text-sm font-semibold ${themeStyles.titleText} block`}>
                          {formatCurrency(item.totalPrice)}
                        </span>
                        {item.quantity > 1 && (
                          <span className={`text-[10.5px] ${themeStyles.subtext}`}>
                            {formatCurrency(item.unitPrice)} each
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <span className={`material-symbols-outlined text-[48px] mb-3 ${themeStyles.emptyIcon}`}>
                      shopping_cart
                    </span>
                    <h3 className={`font-garamond text-2xl font-medium ${themeStyles.emptyTitle}`}>
                      Ready for Your Order
                    </h3>
                    <p className={`text-xs max-w-xs mt-1 ${themeStyles.emptySubtitle}`}>
                      Your items and live order summary will appear here as they are added at the register.
                    </p>
                  </div>
                )}
              </div>

              {/* Running Totals Breakdown */}
              <div
                className={`p-6 ${themeStyles.summaryBg} border-t ${themeStyles.border} shrink-0 space-y-2`}
              >
                <div className="flex justify-between text-xs">
                  <span className={themeStyles.subtext}>Items Subtotal</span>
                  <span className={themeStyles.titleText}>{formatCurrency(session.totals?.subTotal)}</span>
                </div>

                {Boolean(session.totals?.discountAmount) && (
                  <div className="flex justify-between text-xs text-emerald-500 font-medium">
                    <span>Discount Applied</span>
                    <span>- {formatCurrency(session.totals?.discountAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-xs">
                  <span className={themeStyles.subtext}>Taxes (CGST + SGST / VAT)</span>
                  <span className={themeStyles.titleText}>{formatCurrency(session.totals?.taxTotal)}</span>
                </div>

                <div className={`pt-2 border-t ${themeStyles.border} flex justify-between items-baseline`}>
                  <div>
                    <span className={`text-xs uppercase tracking-wider font-semibold ${themeStyles.subtext} block`}>
                      Total Payable
                    </span>
                    <span className={`text-[11px] ${themeStyles.subtext}`}>
                      Taxes &amp; fees included
                    </span>
                  </div>
                  <span className={`font-garamond text-3xl font-bold ${themeStyles.titleText}`}>
                    {formatCurrency(session.totals?.totalAmount)}
                  </span>
                </div>
              </div>

              {/* Dynamic QR or Cash Breakdown Overlay */}
              {session.state === "payment_qr" && effectiveSettings?.showPaymentQr && (
                <div className={`p-6 ${themeStyles.card} border-t ${themeStyles.border} flex flex-col sm:flex-row items-center justify-between gap-6 shrink-0`}>
                  <div className="space-y-1 text-center sm:text-left">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider inline-block">
                      Instant Scan &amp; Pay
                    </span>
                    <h3 className={`font-garamond text-xl font-medium ${themeStyles.titleText}`}>
                      Scan UPI QR Code
                    </h3>
                    <p className={`text-xs ${themeStyles.subtext}`}>
                      Supports Google Pay, PhonePe, Paytm, BHIM, Cred
                    </p>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl shadow-md border border-stone-200 shrink-0">
                    <QRCodeSVG
                      value={
                        session.payment?.dynamicQrString ||
                        `upi://pay?pa=${encodeURIComponent(
                          effectiveSettings?.storeUpiAddress || "skyz.banquet@icici"
                        )}&pn=${encodeURIComponent(
                          effectiveSettings?.merchantDisplayName || "Skyz Restaurant"
                        )}&am=${((session.totals?.totalAmount || 0) / 100).toFixed(
                          2
                        )}&cu=INR`
                      }
                      size={110}
                      level="M"
                    />
                  </div>
                </div>
              )}

              {/* Cash Tendered Banner */}
              {session.state === "cash_tender" &&
                effectiveSettings?.showCashTenderedChangeDue && (
                  <div className="p-4 bg-emerald-700 text-white flex items-center justify-around shrink-0 font-sans">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-emerald-200 block">
                        Cash Tendered
                      </span>
                      <span className="text-xl font-bold">
                        {formatCurrency(session.payment?.tenderedAmount)}
                      </span>
                    </div>
                    <div className="h-8 w-px bg-emerald-600"></div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-emerald-200 block">
                        Change Due
                      </span>
                      <span className="text-xl font-bold text-white">
                        {formatCurrency(session.payment?.changeDue)}
                      </span>
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* STATE 4: POST-PAYMENT SUCCESS & SURVEY & WHATSAPP RECEIPT */}
        {session.state === "completed" && (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 lg:p-12 text-center max-w-3xl mx-auto space-y-6">
            {/* Success Checkmark & Token Callout */}
            <div className="space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
                <span className="material-symbols-outlined text-[36px]">
                  check
                </span>
              </div>
              <h2 className={`font-garamond text-3xl lg:text-4xl font-medium ${themeStyles.titleText}`}>
                Payment Successful!
              </h2>
              <p className={`text-xs ${themeStyles.subtext}`}>
                Thank you for ordering with us. Please collect your order at the counter.
              </p>
            </div>

            {/* Token Number Box */}
            <div className={`p-5 px-8 ${themeStyles.tokenBox} rounded-2xl border-2 shadow-md inline-block`}>
              <span className={`text-[11px] uppercase tracking-wider ${themeStyles.subtext} font-bold block mb-1`}>
                Your Order Token Number
              </span>
              <span className={`font-garamond text-5xl font-bold ${themeStyles.titleText} tracking-wider`}>
                {session.tokenNumber || "#12"}
              </span>
            </div>

            {/* Touch 5-Star Survey Feedback */}
            {effectiveSettings?.showStarRatingSurvey && (
              <div className={`w-full ${themeStyles.feedbackCard} rounded-2xl p-6 border shadow-xs space-y-3`}>
                <div className="space-y-0.5">
                  <span className={`text-[11px] uppercase tracking-wider ${themeStyles.subtext} font-bold`}>
                    Quick Feedback
                  </span>
                  <h3 className={`font-garamond text-xl font-medium ${themeStyles.titleText}`}>
                    How was your experience today?
                  </h3>
                </div>

                {isRatingSubmitted ? (
                  <p className="text-sm text-emerald-500 font-semibold py-2">
                    ★ Thank you for your feedback!
                  </p>
                ) : (
                  <div className="flex justify-center gap-4 py-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => handleRating(star)}
                        className={`w-12 h-12 rounded-full border-2 transition-all flex items-center justify-center text-xl cursor-pointer ${
                          ratingScore && ratingScore >= star
                            ? `${themeStyles.accent} border-transparent scale-105`
                            : `border-[#d0c4be] hover:${themeStyles.titleText} hover:${themeStyles.highlight}`
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* WhatsApp E-Receipt Prompt */}
            {effectiveSettings?.showWhatsappReceipt && (
              <div className={`w-full ${themeStyles.receiptCard} rounded-2xl p-4 border flex flex-col sm:flex-row items-center justify-between gap-3`}>
                <div className="text-left">
                  <span className={`text-xs font-semibold ${themeStyles.titleText} block`}>
                    Get Digital E-Receipt on WhatsApp
                  </span>
                  <span className={`text-[11px] ${themeStyles.subtext}`}>
                    Save paper • Verified PDF receipt delivered instantly
                  </span>
                </div>

                {isReceiptSent ? (
                  <span className="text-xs font-semibold text-emerald-500 py-1 px-3 bg-emerald-950/40 rounded-full border border-emerald-500/30">
                    Receipt Sent!
                  </span>
                ) : (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="tel"
                      value={whatsappPhone}
                      onChange={(e) => setWhatsappPhone(e.target.value)}
                      placeholder="+91 Mobile Number"
                      className={`px-3 py-1.5 rounded-full ${themeStyles.inputBg} border text-xs focus:outline-none w-full sm:w-44`}
                    />
                    <button
                      type="button"
                      onClick={handleSendReceipt}
                      className={`px-4 py-1.5 rounded-full ${themeStyles.accent} text-xs font-medium shrink-0 cursor-pointer shadow-sm`}
                    >
                      Send
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

export default function FrontDisplayPage() {
  return (
    <Suspense fallback={null}>
      <FrontDisplayContent />
    </Suspense>
  );
}
