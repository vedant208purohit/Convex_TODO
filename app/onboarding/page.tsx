"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser, useClerk } from "@clerk/nextjs";
import { OnboardingLaunchChecklist } from "./components/OnboardingLaunchChecklist";

// Business types from Screen 1
const BUSINESS_TYPES = [
  { val: "fsg", title: "Full-Service Restaurant", sub: "Dine-in / Bar" },
  { val: "qsr", title: "Quick Service", sub: "Counter / Fast" },
  { val: "fc", title: "Fast Casual", sub: "Hybrid Flow" },
  { val: "cafe", title: "Cafe & Coffee Shop", sub: "Roastery / Tea" },
  { val: "bakery", title: "Bakery & Dessert Shop", sub: "Artisan Baked" },
  { val: "bar", title: "Bar & Pub", sub: "Nightlife / Tap" },
  { val: "truck", title: "Food Truck", sub: "Mobile POS" },
  { val: "ghost", title: "Ghost Kitchen", sub: "Delivery Only" },
  { val: "other", title: "Other", sub: "Custom Setup" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();

  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;
  const currentMembership = useQuery(
    api.organizationUsers.getCurrentMembership,
    activeOrg ? { organizationId: activeOrg._id } : "skip"
  );
  const saveOnboardingMutation = useMutation(api.organizations.saveOnboarding);

  const [activeStep, setActiveStep] = useState<number>(1);

  // Toast state
  const [toast, setToast] = useState<{ show: boolean; title: string; message: string }>({
    show: false,
    title: "",
    message: "",
  });

  const showToast = (title: string, message: string) => {
    setToast({ show: true, title, message });
    setTimeout(() => {
      setToast({ show: false, title: "", message: "" });
    }, 3200);
  };

  // Step 1 State: Organisation & Restaurant
  const [orgName, setOrgName] = useState("");
  const [restName, setRestName] = useState("");
  const [businessType, setBusinessType] = useState("fsg");
  const [locationsCount, setLocationsCount] = useState<"one" | "multiple">("one");

  // Google Places Real-Time Search State
  const [placesDropdownOpen, setPlacesDropdownOpen] = useState(false);
  const [placesSearchLoading, setPlacesSearchLoading] = useState(false);
  const [placesSuggestions, setPlacesSuggestions] = useState<
    Array<{ placeId: string; name: string; address: string; secondaryText?: string }>
  >([]);
  const [selectedPlace, setSelectedPlace] = useState<{
    placeId: string;
    name: string;
    address: string;
  } | null>(null);

  const [isManualEntry, setIsManualEntry] = useState(false);
  const [orgError, setOrgError] = useState("");
  const [restError, setRestError] = useState("");

  // Step 2 State: Location Details
  const [locationName, setLocationName] = useState("");
  const [country, setCountry] = useState("US");
  const [streetAddress, setStreetAddress] = useState("");
  const [suiteUnit, setSuiteUnit] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [language, setLanguage] = useState("en-US");
  const [timezone, setTimezone] = useState("America/Los_Angeles");

  // Step 3 State: Operations & Fulfillment
  const [isDineIn, setIsDineIn] = useState(true);
  const [isPickup, setIsPickup] = useState(true);
  const [isDelivery, setIsDelivery] = useState(true);
  const [deliveryFleetType, setDeliveryFleetType] = useState<"inhouse" | "thirdparty" | "blended">("blended");
  const [operatingHours, setOperatingHours] = useState<"standard" | "custom" | "later">("standard");
  const [customSchedule, setCustomSchedule] = useState<{
    weekdayStart: string;
    weekdayEnd: string;
    weekendStart: string;
    weekendEnd: string;
  }>({
    weekdayStart: "11:00",
    weekdayEnd: "22:00",
    weekendStart: "11:00",
    weekendEnd: "23:00",
  });

  const [savingStep, setSavingStep] = useState(false);

  // Search input debounce ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize from active organization if present
  useEffect(() => {
    if (activeOrg) {
      const isOwner = Boolean(
        activeOrg.ownerClerkId && user?.id && activeOrg.ownerClerkId === user.id
      );
      const isStaff = !isOwner && currentMembership && !currentMembership.userType?.includes("admin");

      // If store is already provisioned and employee is not the store owner/admin,
      // they don't do store setup onboarding. Redirect them straight onto the dashboard!
      if (isStaff) {
        router.replace("/dashboard");
        return;
      }

      // If checklist is already completed by owner, redirect straight to dashboard
      if (activeOrg.onboardingCompleted) {
        router.replace("/dashboard");
        return;
      }

      // If store is already provisioned (organization exists), lock directly into Step 4 (Launch Checklist)
      // to prevent re-entering or re-submitting Steps 1-3.
      if (activeOrg.onboardingStep && activeOrg.onboardingStep >= 4) {
        setActiveStep(4);
      } else if (activeOrg.onboardingStep && activeOrg.onboardingStep >= 1 && activeOrg.onboardingStep <= 3) {
        setActiveStep(activeOrg.onboardingStep);
      } else {
        // If an organization record already exists in the store, default to Step 4
        setActiveStep(4);
      }

      // Step 1
      if (activeOrg.legalEntityName) setOrgName(activeOrg.legalEntityName);
      else if (activeOrg.name) setOrgName(activeOrg.name);

      if (activeOrg.name) {
        setRestName(activeOrg.name);
        setLocationName(`${activeOrg.name} — Downtown`);
      }
      if (activeOrg.businessType) setBusinessType(activeOrg.businessType);
      if (activeOrg.locationsCount === "multiple") setLocationsCount("multiple");

      // Step 2
      if (activeOrg.country) setCountry(activeOrg.country);
      if (activeOrg.addressLine1) setStreetAddress(activeOrg.addressLine1);
      if (activeOrg.suiteUnit) setSuiteUnit(activeOrg.suiteUnit);
      if (activeOrg.city) setCity(activeOrg.city);
      if (activeOrg.state) setState(activeOrg.state);
      if (activeOrg.zipCode) setZipCode(activeOrg.zipCode);
      if (activeOrg.phone) setPhoneNumber(activeOrg.phone);
      if (activeOrg.defaultCurrency) setCurrency(activeOrg.defaultCurrency);
      if (activeOrg.language) setLanguage(activeOrg.language);
      if (activeOrg.organizationTimeZone) setTimezone(activeOrg.organizationTimeZone);

      // Step 3
      if (activeOrg.isDineIn !== undefined) setIsDineIn(activeOrg.isDineIn);
      if (activeOrg.isTakeAway !== undefined) setIsPickup(activeOrg.isTakeAway);
      if (activeOrg.isDelivery !== undefined) setIsDelivery(activeOrg.isDelivery);
      if (activeOrg.deliveryFleetType) setDeliveryFleetType(activeOrg.deliveryFleetType as any);
      if (activeOrg.operatingHoursTemplate) setOperatingHours(activeOrg.operatingHoursTemplate as any);
    }
  }, [activeOrg, currentMembership, user?.id, router]);

  // Real Google Places Autocomplete Query
  const fetchPlacesPredictions = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setPlacesSuggestions([]);
      return;
    }

    setPlacesSearchLoading(true);
    try {
      const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (data.predictions) {
        setPlacesSuggestions(data.predictions);
      } else {
        setPlacesSuggestions([]);
      }
    } catch (err) {
      console.error("Autocomplete fetch error:", err);
      setPlacesSuggestions([]);
    } finally {
      setPlacesSearchLoading(false);
    }
  };

  const handleRestaurantNameChange = (val: string) => {
    setRestName(val);
    if (val.trim()) setRestError("");

    // If typing something new after a selection, clear selected place
    if (selectedPlace && selectedPlace.name !== val) {
      setSelectedPlace(null);
    }

    // Debounce Google Places call
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (!isManualEntry && val.trim().length >= 2) {
      setPlacesDropdownOpen(true);
      debounceTimerRef.current = setTimeout(() => {
        fetchPlacesPredictions(val);
      }, 300);
    } else {
      setPlacesSuggestions([]);
    }
  };

  // Real Google Place Details Fetch & Auto-Fill
  const handleSelectPlace = async (place: { placeId: string; name: string; address: string }) => {
    setPlacesDropdownOpen(false);
    setSelectedPlace(place);
    setRestName(place.name);
    setLocationName(`${place.name} — Main`);
    setIsManualEntry(false);

    showToast("Fetching Location Details...", "Retrieving address, direct phone & regional preferences from Google Places.");

    try {
      const res = await fetch(`/api/places/details?placeId=${encodeURIComponent(place.placeId)}`);
      const details = await res.json();

      if (!res.ok || details.error) {
        console.warn("Place details error, using prediction text:", details.error);
        setStreetAddress(place.address);
        return;
      }

      // Pre-fill Step 2 & 3 with verified Google Places data
      if (details.name) {
        setRestName(details.name);
        setLocationName(`${details.name} — Main`);
      }
      if (details.streetAddress) setStreetAddress(details.streetAddress);
      if (details.city) setCity(details.city);
      if (details.state) setState(details.state);
      if (details.postalCode) setZipCode(details.postalCode);
      if (details.country) setCountry(details.country);
      if (details.phoneNumber) setPhoneNumber(details.phoneNumber);
      if (details.currency) setCurrency(details.currency);
      if (details.timezone) {
        setTimezone(details.timezone);
      } else if (details.country === "IN") {
        setTimezone("Asia/Kolkata");
      } else if (details.country === "GB") {
        setTimezone("Europe/London");
      } else if (details.country === "AE") {
        setTimezone("Asia/Dubai");
      }

      // Auto-detect business type with comprehensive Google classification
      const placeTypes: string[] = Array.isArray(details.types) ? details.types : [];
      const placeNameLower: string = (details.name || place.name || "").toLowerCase();

      // Priority 1: Bakery / Dessert
      if (
        placeTypes.includes("bakery") ||
        placeNameLower.includes("bakery") ||
        placeNameLower.includes("cake") ||
        placeNameLower.includes("dessert") ||
        placeNameLower.includes("sweets")
      ) {
        setBusinessType("bakery");
      }
      // Priority 2: Cafe / Coffee Shop
      else if (
        placeTypes.includes("cafe") ||
        placeNameLower.includes("cafe") ||
        placeNameLower.includes("coffee") ||
        placeNameLower.includes("tea")
      ) {
        setBusinessType("cafe");
      }
      // Priority 3: Bar & Pub (ONLY if truly a night venue, bar type, or serves beer/wine, and not a family/dining restaurant)
      else if (
        (placeTypes.includes("bar") ||
          placeTypes.includes("night_club") ||
          placeNameLower.includes("bar & pub") ||
          placeNameLower.includes("brewery") ||
          placeNameLower.includes("pub")) &&
        (details.servesBeer || details.servesWine) &&
        !placeTypes.includes("restaurant")
      ) {
        setBusinessType("bar");
      }
      // Priority 4: Quick Service / Fast Food / Food Truck
      else if (
        placeTypes.includes("meal_takeaway") &&
        !details.dineIn
      ) {
        setBusinessType("qsr");
      }
      // Priority 5: Full-Service Restaurant (Dine-in dining room, Indian/Kathiyawadi restaurant, Bistro, Fine Dining)
      else if (
        placeTypes.includes("restaurant") ||
        details.dineIn ||
        placeNameLower.includes("restaurant") ||
        placeNameLower.includes("bistro") ||
        placeNameLower.includes("kathiyawadi") ||
        placeNameLower.includes("dhaba")
      ) {
        setBusinessType("fsg");
      } else {
        setBusinessType("fsg");
      }

      if (details.dineIn !== undefined) setIsDineIn(details.dineIn);
      if (details.takeout !== undefined) setIsPickup(details.takeout);
      if (details.delivery !== undefined) setIsDelivery(details.delivery);

      showToast("Restaurant Verified", `Address and contact details populated from Google Places.`);
    } catch (err) {
      console.error("Failed to fetch Google Place details:", err);
      setStreetAddress(place.address);
    }
  };

  // Handle Step 1 Submit
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;

    if (!orgName.trim()) {
      setOrgError("Please enter your organisation name.");
      hasError = true;
    } else {
      setOrgError("");
    }

    if (!restName.trim()) {
      setRestError("Please enter your restaurant name.");
      hasError = true;
    } else {
      setRestError("");
    }

    if (hasError) return;

    if (!locationName.trim()) {
      setLocationName(`${restName.trim()} — Main`);
    }

    setSavingStep(true);
    try {
      if (activeOrg) {
        await saveOnboardingMutation({
          id: activeOrg._id,
          step: 2,
          organizationName: orgName.trim(),
          restaurantName: restName.trim(),
          businessType,
          locationsCount,
        });
      }
      showToast("Organisation Configured", "Proceeding to Step 2: Location...");
      setTimeout(() => {
        setSavingStep(false);
        setActiveStep(2);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 400);
    } catch (err) {
      console.error(err);
      setSavingStep(false);
      setActiveStep(2);
    }
  };

  // Handle Step 2 Submit
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStep(true);

    try {
      if (activeOrg) {
        await saveOnboardingMutation({
          id: activeOrg._id,
          step: 3,
          restaurantName: locationName.trim() || restName.trim(),
          addressLine1: streetAddress.trim(),
          suiteUnit: suiteUnit.trim(),
          city: city.trim(),
          state: state.trim(),
          zipCode: zipCode.trim(),
          country: country.trim(),
          phone: phoneNumber.trim(),
          currency: currency.trim(),
          language: language.trim(),
          organizationTimeZone: timezone.trim(),
        });
      }
      showToast("Location Configured", "Proceeding to Step 3: Operations...");
      setTimeout(() => {
        setSavingStep(false);
        setActiveStep(3);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 400);
    } catch (err) {
      console.error(err);
      setSavingStep(false);
      setActiveStep(3);
    }
  };

  // Handle Step 3 Final Submit
  const handleStep3Submit = async () => {
    // Validation: At least one service mode must remain enabled (matching Settings > Features)
    if (!isDineIn && !isPickup && !isDelivery) {
      showToast("Service Mode Required", "Please select at least one fulfillment modality (Dine-In, Pickup, or Delivery).");
      return;
    }

    setSavingStep(true);

    try {
      // Construct standard 7-day operational timing matching Settings > Organization > Operational Timings
      const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      let generatedOperationTiming: Record<string, any> | undefined = undefined;

      if (operatingHours === "standard") {
        // 11:00 AM – 10:00 PM (22:00) every day
        generatedOperationTiming = {};
        DAYS.forEach((day) => {
          generatedOperationTiming![day] = {
            is_open: true,
            is_open_all_day: false,
            hours: [{ start_time: "11:00", end_time: "22:00" }],
          };
        });
      } else if (operatingHours === "custom") {
        // Weekdays (Mon-Fri) vs Weekends (Sat-Sun)
        generatedOperationTiming = {};
        DAYS.forEach((day) => {
          const isWeekend = day === "Saturday" || day === "Sunday";
          generatedOperationTiming![day] = {
            is_open: true,
            is_open_all_day: false,
            hours: [
              {
                start_time: isWeekend ? customSchedule.weekendStart : customSchedule.weekdayStart,
                end_time: isWeekend ? customSchedule.weekendEnd : customSchedule.weekdayEnd,
              },
            ],
          };
        });
      } else if (operatingHours === "later") {
        // Defer Schedule: Keep default 11:00 – 23:59 or existing
        generatedOperationTiming = {};
        DAYS.forEach((day) => {
          generatedOperationTiming![day] = {
            is_open: true,
            is_open_all_day: false,
            hours: [{ start_time: "11:00", end_time: "23:59" }],
          };
        });
      }

      // If this is a new store (no activeOrg yet), trigger full store provisioning (Creates dedicated Convex project)
      if (!activeOrg) {
        const res = await fetch("/api/store/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationName: orgName.trim(),
            restaurantName: restName.trim(),
            businessType,
            locationsCount,
            addressLine1: streetAddress.trim(),
            suiteUnit: suiteUnit.trim(),
            city: city.trim(),
            state: state.trim(),
            zipCode: zipCode.trim(),
            country: country.trim(),
            phone: phoneNumber.trim(),
            currency: currency.trim(),
            language: language.trim(),
            organizationTimeZone: timezone.trim(),
            isDineIn,
            isTakeAway: isPickup,
            isDelivery,
            deliveryFleetType,
            operatingHoursTemplate: operatingHours,
            operationTiming: generatedOperationTiming,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to provision new store.");
        }

        showToast("Store Created", "Dedicated backend provisioned! Opening Launch Checklist...");
        setTimeout(() => {
          setSavingStep(false);
          setActiveStep(4);
        }, 1000);
        return;
      }

      await saveOnboardingMutation({
        id: activeOrg._id,
        step: 4,
        completed: false,
        isDineIn,
        isTakeAway: isPickup,
        isDelivery,
        deliveryFleetType,
        operatingHoursTemplate: operatingHours,
        operationTiming: generatedOperationTiming,
      });

      showToast("Store Configured", "Opening Setup Checklist...");
      setSavingStep(false);
      setActiveStep(4);
    } catch (err) {
      console.error(err);
      setSavingStep(false);
      setActiveStep(4);
    }
  };

  const userEmail = user?.primaryEmailAddress?.emailAddress || "owner@restaurant.com";
  const userInitials = (user?.firstName ? user.firstName[0] : "P") + (user?.lastName ? user.lastName[0] : "S");

  return (
    <div className="min-h-screen w-full bg-[#fbf7f4] text-[#1d1b1a] font-sans antialiased selection:bg-[#e9e1dd]">
      {/* Toast Feedback Notification */}
      <div
        className={`fixed top-5 right-5 z-50 transform transition-all duration-300 flex items-center gap-3 bg-[#1f1f1f] text-white px-4 py-3 rounded-lg shadow-xl border border-neutral-700 ${
          toast.show ? "translate-y-0 opacity-100" : "-translate-y-10 opacity-0 pointer-events-none"
        }`}
      >
        <span className="material-symbols-outlined text-emerald-400 text-[20px]">check_circle</span>
        <div>
          <p className="text-sm font-medium text-white">{toast.title}</p>
          <p className="text-xs text-neutral-300">{toast.message}</p>
        </div>
      </div>

      <main className="min-h-screen w-full flex items-center justify-center p-4 md:p-6 bg-[#fbf7f4]">
        <div className="flex flex-col w-full items-center justify-center py-6 px-2 md:px-6 max-w-4xl">
          {/* Minimalist Atelier Brand Chrome */}
          <header className="w-full flex items-center justify-between py-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="font-serif text-2xl tracking-widest text-[#1d1b1a] uppercase font-normal">PREST</span>
              <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-[#eadfd6]"></span>
              <span className="hidden sm:inline-block text-xs tracking-wider uppercase text-[#645d58]">POS Studio</span>
            </div>
            <div className="flex items-center gap-3 bg-[#faf2ee] px-3 py-1.5 rounded-full border border-[#eadfd6]/60 shadow-sm">
              <div className="w-6 h-6 rounded-full bg-[#e9e1dd] flex items-center justify-center text-[#4d4541] text-xs font-medium">
                {userInitials}
              </div>
              <span className="text-xs text-[#1d1b1a] font-medium">{userEmail}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            </div>
          </header>

          {/* Stepper Indicator */}
          <div className="w-full max-w-2xl mb-8 flex flex-col items-center">
            <div className="flex items-center justify-between w-full max-w-md relative mb-3">
              {/* Background Connecting Line */}
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#e9e1dd] -translate-y-1/2 z-0"></div>
              {/* Progress Bar Active Portion */}
              <div
                className={`absolute top-1/2 left-0 h-0.5 bg-[#1f1f1f] -translate-y-1/2 z-0 transition-all duration-300 ${
                  activeStep === 1
                    ? "w-[12%]"
                    : activeStep === 2
                    ? "w-[38%]"
                    : activeStep === 3
                    ? "w-[68%]"
                    : "w-full"
                }`}
              ></div>

              {/* Step 1 */}
              <div className="relative z-10 flex flex-col items-center">
                <button
                  type="button"
                  disabled={Boolean(activeOrg)}
                  onClick={() => {
                    if (!activeOrg) setActiveStep(1);
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shadow-sm ring-4 ring-[#fbf7f4] transition-colors ${
                    activeOrg
                      ? "bg-[#e9e1dd] text-[#1d1b1a] cursor-not-allowed opacity-80"
                      : activeStep === 1
                      ? "bg-[#1f1f1f] text-white cursor-pointer"
                      : "bg-[#e9e1dd] text-[#1d1b1a] cursor-pointer"
                  }`}
                >
                  {activeStep > 1 || activeOrg ? (
                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                  ) : (
                    "1"
                  )}
                </button>
              </div>

              {/* Step 2 */}
              <div className="relative z-10 flex flex-col items-center">
                <button
                  type="button"
                  disabled={Boolean(activeOrg)}
                  onClick={() => {
                    if (!activeOrg && orgName && restName) setActiveStep(2);
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ring-4 ring-[#fbf7f4] transition-colors ${
                    activeOrg
                      ? "bg-[#e9e1dd] text-[#1d1b1a] cursor-not-allowed opacity-80"
                      : activeStep === 2
                      ? "bg-[#1f1f1f] text-white font-semibold cursor-pointer"
                      : activeStep > 2
                      ? "bg-[#e9e1dd] text-[#1d1b1a] cursor-pointer"
                      : "bg-[#eee7e3] text-[#4d4541] cursor-pointer"
                  }`}
                >
                  {activeStep > 2 || activeOrg ? (
                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                  ) : (
                    "2"
                  )}
                </button>
              </div>

              {/* Step 3 */}
              <div className="relative z-10 flex flex-col items-center">
                <button
                  type="button"
                  disabled={Boolean(activeOrg)}
                  onClick={() => {
                    if (!activeOrg && orgName && restName) setActiveStep(3);
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ring-4 ring-[#fbf7f4] transition-colors ${
                    activeOrg
                      ? "bg-[#e9e1dd] text-[#1d1b1a] cursor-not-allowed opacity-80"
                      : activeStep === 3
                      ? "bg-[#1f1f1f] text-white font-semibold cursor-pointer"
                      : activeStep > 3
                      ? "bg-[#e9e1dd] text-[#1d1b1a] cursor-pointer"
                      : "bg-[#eee7e3] text-[#4d4541] cursor-pointer"
                  }`}
                >
                  {activeStep > 3 || activeOrg ? (
                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                  ) : (
                    "3"
                  )}
                </button>
              </div>

              {/* Step 4 */}
              <div className="relative z-10 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (activeOrg || (orgName && restName)) setActiveStep(4);
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ring-4 ring-[#fbf7f4] transition-colors cursor-pointer ${
                    activeStep === 4
                      ? "bg-[#1f1f1f] text-white font-semibold"
                      : "bg-[#eee7e3] text-[#4d4541]"
                  }`}
                >
                  4
                </button>
              </div>
            </div>

            {/* Stepper Text Details */}
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-[#645d58]">Step {activeStep} of 4</span>
              <span className="text-[#645d58]">•</span>
              <span className="text-xs font-semibold text-[#1d1b1a] uppercase tracking-wider">
                {activeStep === 1
                  ? "Organisation"
                  : activeStep === 2
                  ? "Location"
                  : activeStep === 3
                  ? "Operations"
                  : "Launch Checklist"}
              </span>
            </div>
          </div>

          {/* ================= STEP 1 SCREEN ================= */}
          {activeStep === 1 && (
            <>
              {/* Editorial Section Header */}
              <div className="text-center max-w-xl mb-8">
                <h1 className="font-serif text-3xl md:text-4xl text-[#1d1b1a] mb-2 font-normal">Welcome to PREST</h1>
                <p className="text-base text-[#645d58]">Let’s get your restaurant set up. First, tell us about your business.</p>
              </div>

              {/* Centered Form Ledger Card */}
              <div className="w-full max-w-[680px] bg-white border border-[#EADFD6] rounded-xl shadow-sm p-6 sm:p-10 mb-10">
                <form className="space-y-8" onSubmit={handleStep1Submit} noValidate>
                  {/* Section A: Organisation & Restaurant Names */}
                  <div className="space-y-6">
                    {/* Field 1: Organisation Name */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-[#1d1b1a]" htmlFor="org-name">
                          Organisation Name <span className="text-[#ba1a1a]">*</span>
                        </label>
                        <span className="text-xs text-[#645d58] bg-[#faf2ee] px-2 py-0.5 rounded border border-[#eadfd6]/60">Entity Level</span>
                      </div>
                      <div className="relative">
                        <input
                          id="org-name"
                          name="organisation_name"
                          type="text"
                          className={`w-full px-4 py-3 rounded-lg bg-white text-[#1d1b1a] text-sm border ${
                            orgError ? "border-[#ba1a1a]" : "border-[#eadfd6]"
                          } outline-none focus:border-[#1f1f1f] focus:ring-1 focus:ring-[#1f1f1f] transition-all placeholder:text-[#7f7570]`}
                          placeholder="e.g. Spice Garden Group"
                          value={orgName}
                          onChange={(e) => {
                            setOrgName(e.target.value);
                            if (e.target.value.trim()) setOrgError("");
                          }}
                        />
                      </div>
                      {orgError && (
                        <p className="text-[#ba1a1a] text-xs flex items-center gap-1 mt-1">
                          <span className="material-symbols-outlined text-[16px]">error</span>
                          {orgError}
                        </p>
                      )}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-0.5">
                        <p className="text-xs text-[#645d58]">Your main business entity or restaurant group name registered for billing.</p>
                        <button
                          type="button"
                          onClick={() => {
                            if (orgName.trim()) {
                              setRestName(orgName.trim());
                              setRestError("");
                              showToast("Name Copied", "Restaurant name updated from organisation.");
                            } else {
                              setOrgError("Please enter organisation name first.");
                            }
                          }}
                          className="inline-flex items-center gap-1.5 text-[#645d58] hover:text-[#1d1b1a] text-xs transition-colors self-start sm:self-auto group shrink-0 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px] group-hover:scale-110 transition-transform">content_copy</span>
                          <span>Use organisation name for restaurant name</span>
                        </button>
                      </div>
                    </div>

                    {/* Field 2: Restaurant Name with Real Google Places */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-[#1d1b1a]" htmlFor="rest-name">
                          Restaurant Name <span className="text-[#ba1a1a]">*</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-xs text-[#645d58] bg-[#faf2ee] px-2 py-0.5 rounded border border-[#eadfd6]/60">
                            <span className="material-symbols-outlined text-[13px] text-[#645d58]">location_on</span>
                            Google Places Real-Time
                          </span>
                        </div>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#645d58]">
                          {placesSearchLoading ? (
                            <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                          ) : (
                            <span className="material-symbols-outlined text-[18px]">search</span>
                          )}
                        </div>
                        <input
                          id="rest-name"
                          name="restaurant_name"
                          type="text"
                          autoComplete="off"
                          className={`w-full pl-10 pr-10 py-3 rounded-lg bg-white text-[#1d1b1a] text-sm border ${
                            restError ? "border-[#ba1a1a]" : "border-[#eadfd6]"
                          } outline-none focus:border-[#1f1f1f] focus:ring-1 focus:ring-[#1f1f1f] transition-all placeholder:text-[#7f7570]`}
                          placeholder="Search your restaurant name on Google..."
                          value={restName}
                          onChange={(e) => handleRestaurantNameChange(e.target.value)}
                          onFocus={() => {
                            if (!isManualEntry && restName.trim().length >= 2) {
                              setPlacesDropdownOpen(true);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!isManualEntry && restName.trim().length >= 2) {
                              setPlacesDropdownOpen(!placesDropdownOpen);
                            }
                          }}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#645d58] hover:text-[#1d1b1a] cursor-pointer"
                          title="Toggle Places suggestions"
                        >
                          <span className="material-symbols-outlined text-[18px]">arrow_drop_down</span>
                        </button>

                        {/* Real Google Places Autocomplete Dropdown */}
                        {placesDropdownOpen && (
                          <div className="absolute z-50 left-0 right-0 top-[calc(100%+4px)] bg-white border border-[#EADFD6] rounded-lg shadow-xl overflow-hidden">
                            <div className="px-3 py-2 bg-[#faf2ee]/70 border-b border-[#eadfd6]/60 flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-[#645d58] text-xs">
                                <span className="material-symbols-outlined text-[14px]">place</span>
                                <span className="font-medium">Live Google Places Suggestions</span>
                              </div>
                              <span className="text-xs text-[#645d58]/80">
                                {placesSearchLoading ? "Searching Google..." : `${placesSuggestions.length} found`}
                              </span>
                            </div>

                            <ul className="divide-y divide-[#eadfd6]/50 max-h-64 overflow-y-auto">
                              {placesSuggestions.length > 0 ? (
                                placesSuggestions.map((p) => (
                                  <li key={p.placeId}>
                                    <button
                                      type="button"
                                      onClick={() => handleSelectPlace(p)}
                                      className="w-full px-3.5 py-2.5 text-left flex items-start gap-2.5 hover:bg-[#faf2ee] transition-colors group cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-[#645d58] group-hover:text-[#1f1f1f] mt-0.5 text-[18px] shrink-0">
                                        location_on
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm font-semibold text-[#1d1b1a] group-hover:text-[#1f1f1f] truncate">
                                            {p.name}
                                          </span>
                                          {selectedPlace?.placeId === p.placeId && (
                                            <span className="text-[11px] font-medium text-emerald-800 bg-emerald-100/70 px-1.5 py-0.5 rounded shrink-0 ml-2">
                                              Selected
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs text-[#645d58] truncate mt-0.5">{p.address}</p>
                                      </div>
                                    </button>
                                  </li>
                                ))
                              ) : (
                                <li className="px-4 py-3 text-center text-xs text-[#645d58]">
                                  {placesSearchLoading
                                    ? "Searching Google Places..."
                                    : "No matching restaurants found on Google Places."}
                                </li>
                              )}
                            </ul>

                            <div className="px-3.5 py-2.5 bg-[#faf2ee] border-t border-[#eadfd6]/60 flex items-center justify-between text-[#645d58]">
                              <span className="text-xs">My restaurant isn't listed?</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsManualEntry(true);
                                  setPlacesDropdownOpen(false);
                                  showToast("Manual Entry Mode", "You can type any custom name and enter location manually.");
                                }}
                                className="text-xs font-medium text-[#1f1f1f] hover:underline inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>Enter details manually</span>
                                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Confirmed Real Location Badge */}
                      {selectedPlace && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-emerald-100/70 border border-emerald-600/30 text-emerald-800 mt-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0">check_circle</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-emerald-800">Restaurant location found:</span>
                                <span className="text-sm font-medium text-[#1d1b1a] truncate">{selectedPlace.name}</span>
                                <span className="text-[11px] text-[#645d58] bg-white px-1.5 py-0.5 rounded border border-[#eadfd6]/60 truncate max-w-[150px]">
                                  {selectedPlace.placeId}
                                </span>
                              </div>
                              <p className="text-xs text-[#645d58] truncate">{selectedPlace.address} • Location details fetched for Step 2</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setPlacesDropdownOpen(true);
                                if (restName.trim()) fetchPlacesPredictions(restName);
                              }}
                              className="text-xs font-semibold text-[#1f1f1f] hover:text-[#1d1b1a] underline transition-colors px-2 py-1 cursor-pointer"
                            >
                              Change
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Manual Entry Notice if chosen */}
                      {isManualEntry && !selectedPlace && (
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#faf2ee] border border-[#eadfd6] text-xs text-[#645d58] mt-2">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-[#1f1f1f]">edit_note</span>
                            <span>Manual Entry Mode active. You can enter all address details manually in Step 2.</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setIsManualEntry(false);
                              if (restName.trim().length >= 2) {
                                setPlacesDropdownOpen(true);
                                fetchPlacesPredictions(restName);
                              }
                            }}
                            className="font-medium text-[#1f1f1f] hover:underline cursor-pointer"
                          >
                            Search Google
                          </button>
                        </div>
                      )}

                      {restError && (
                        <p className="text-[#ba1a1a] text-xs flex items-center gap-1 mt-1">
                          <span className="material-symbols-outlined text-[16px]">error</span>
                          {restError}
                        </p>
                      )}
                      <p className="text-xs text-[#645d58]">Start typing your restaurant name and select your restaurant from Google Places suggestions.</p>
                    </div>

                    {/* Live Hierarchy Preview Card */}
                    <div className="bg-[#faf2ee] border border-[#eadfd6]/80 rounded-lg p-3.5 sm:p-4">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#eadfd6]/60">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[#645d58] text-[16px]">storefront</span>
                          <span className="text-xs uppercase tracking-wider font-semibold text-[#645d58]">Live Hierarchy Preview</span>
                        </div>
                        <span className="text-xs text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full font-medium">Ready</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                        <div className="flex items-baseline gap-1.5 min-w-0">
                          <span className="text-xs text-[#645d58] shrink-0">Organisation:</span>
                          <span className="text-sm font-semibold text-[#1d1b1a] truncate">{orgName || "Not specified"}</span>
                        </div>
                        <div className="flex items-baseline gap-1.5 min-w-0">
                          <span className="text-xs text-[#645d58] shrink-0">First Restaurant:</span>
                          <span className="text-sm font-semibold text-[#1d1b1a] truncate">{restName || "Not specified"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section B: Business Type Grid */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-[#1d1b1a] block">
                        Business Type <span className="text-[#ba1a1a]">*</span>
                      </label>
                      <span className="text-xs text-[#645d58]">Single Select</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {BUSINESS_TYPES.map((biz) => {
                        const isSelected = businessType === biz.val;
                        return (
                          <button
                            key={biz.val}
                            type="button"
                            onClick={() => setBusinessType(biz.val)}
                            className={`relative text-left p-3.5 rounded-lg text-[#1d1b1a] flex flex-col justify-between h-20 shadow-xs transition-all cursor-pointer ${
                              isSelected
                                ? "bg-[#FAF2EE] border-2 border-[#1F1F1F]"
                                : "bg-white border border-[#EADFD6] hover:bg-[#faf2ee]"
                            }`}
                          >
                            <span className={`text-xs leading-tight ${isSelected ? "font-semibold" : "font-medium"}`}>
                              {biz.title}
                            </span>
                            <div className="flex items-center justify-between mt-auto">
                              <span className="text-xs text-[#645d58]">{biz.sub}</span>
                              <span className={`material-symbols-outlined text-[#1F1F1F] text-[18px] ${isSelected ? "opacity-100" : "opacity-0"}`}>
                                check_circle
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section C: Location Selection */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-[#1d1b1a] block">
                      Number of Locations <span className="text-[#ba1a1a]">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* One Location */}
                      <label
                        onClick={() => setLocationsCount("one")}
                        className={`relative flex items-start p-4 rounded-lg cursor-pointer shadow-xs transition-all ${
                          locationsCount === "one"
                            ? "bg-[#FAF2EE] border-2 border-[#1F1F1F]"
                            : "bg-white border border-[#EADFD6] hover:bg-[#faf2ee]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="locations_count"
                          value="one"
                          checked={locationsCount === "one"}
                          onChange={() => setLocationsCount("one")}
                          className="sr-only"
                        />
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center mr-3 mt-0.5 shrink-0 transition-colors ${
                            locationsCount === "one" ? "bg-[#1f1f1f]" : "bg-[#e9e1dd]"
                          }`}
                        >
                          <span
                            className={`material-symbols-outlined text-[14px] ${
                              locationsCount === "one" ? "text-white" : "text-transparent"
                            }`}
                          >
                            check
                          </span>
                        </div>
                        <div>
                          <span className={`text-sm block leading-tight ${locationsCount === "one" ? "font-semibold" : "font-medium"}`}>
                            One Location
                          </span>
                          <span className="text-xs text-[#645d58] mt-0.5 block">I manage one restaurant.</span>
                        </div>
                      </label>

                      {/* Multiple Locations */}
                      <label
                        onClick={() => setLocationsCount("multiple")}
                        className={`relative flex items-start p-4 rounded-lg cursor-pointer shadow-xs transition-all ${
                          locationsCount === "multiple"
                            ? "bg-[#FAF2EE] border-2 border-[#1F1F1F]"
                            : "bg-white border border-[#EADFD6] hover:bg-[#faf2ee]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="locations_count"
                          value="multiple"
                          checked={locationsCount === "multiple"}
                          onChange={() => setLocationsCount("multiple")}
                          className="sr-only"
                        />
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center mr-3 mt-0.5 shrink-0 transition-colors ${
                            locationsCount === "multiple" ? "bg-[#1f1f1f]" : "bg-[#e9e1dd]"
                          }`}
                        >
                          <span
                            className={`material-symbols-outlined text-[14px] ${
                              locationsCount === "multiple" ? "text-white" : "text-transparent"
                            }`}
                          >
                            check
                          </span>
                        </div>
                        <div>
                          <span className={`text-sm block leading-tight ${locationsCount === "multiple" ? "font-semibold" : "font-medium"}`}>
                            Multiple Locations
                          </span>
                          <span className="text-xs text-[#645d58] mt-0.5 block">I manage multiple restaurant branches.</span>
                        </div>
                      </label>
                    </div>

                    {/* Collapsible Multi-location Info Panel */}
                    {locationsCount === "multiple" && (
                      <div className="transition-all duration-300 overflow-hidden bg-[#faf2ee] border border-[#eadfd6] rounded-lg p-4 space-y-3">
                        <div className="flex items-start gap-2.5">
                          <span className="material-symbols-outlined text-[#1f1f1f] text-xl mt-0.5 shrink-0">corporate_fare</span>
                          <div>
                            <h4 className="text-sm font-semibold text-[#1d1b1a]">Your business can grow with PREST.</h4>
                            <p className="text-sm text-[#645d58] leading-relaxed mt-0.5">
                              You will set up your first restaurant location next. Once your organisation is created, you can add more branches from your dashboard.
                            </p>
                          </div>
                        </div>
                        <ul className="pt-1 border-t border-[#eadfd6]/60 space-y-1.5">
                          <li className="flex items-center gap-2 text-xs text-[#1d1b1a]">
                            <span className="material-symbols-outlined text-[#1f1f1f] text-[16px]">check_circle</span>
                            <span>Manage all restaurant branches in one place.</span>
                          </li>
                          <li className="flex items-center gap-2 text-xs text-[#1d1b1a]">
                            <span className="material-symbols-outlined text-[#1f1f1f] text-[16px]">check_circle</span>
                            <span>Keep location details separate.</span>
                          </li>
                          <li className="flex items-center gap-2 text-xs text-[#1d1b1a]">
                            <span className="material-symbols-outlined text-[#1f1f1f] text-[16px]">check_circle</span>
                            <span>View business performance across locations.</span>
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Section D: Callout */}
                  <div className="bg-[#faf2ee] border border-[#eadfd6]/70 rounded-lg p-4 flex items-start gap-3.5">
                    <span className="material-symbols-outlined text-[#645d58] text-xl shrink-0 mt-0.5">info</span>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-[#1d1b1a]">One organisation, multiple locations.</p>
                      <p className="text-sm text-[#645d58] leading-relaxed">
                        Your organisation is the main account for your restaurant business. Each location represents an individual restaurant branch. You can manage all your locations from one PREST dashboard.
                      </p>
                    </div>
                  </div>

                  {/* Action Row */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => signOut()}
                      className="order-2 sm:order-1 text-sm text-[#645d58] hover:text-[#1d1b1a] transition-colors flex items-center gap-1.5 py-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">logout</span>
                      <span>Sign Out</span>
                    </button>
                    <button
                      id="continue-button"
                      type="submit"
                      disabled={savingStep}
                      className="order-1 sm:order-2 w-full sm:w-auto px-9 py-3.5 rounded-lg bg-[#1f1f1f] text-white text-sm font-medium tracking-wide hover:bg-neutral-800 active:scale-[0.99] shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {savingStep ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Saving Organisation...</span>
                        </>
                      ) : (
                        <>
                          <span>Continue</span>
                          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}

          {/* ================= STEP 2 SCREEN ================= */}
          {activeStep === 2 && (
            <>
              {/* Title Block */}
              <div className="text-center max-w-xl mx-auto mb-8">
                <h1 className="font-serif text-3xl md:text-4xl text-[#1d1b1a] mb-2 font-normal">
                  Where is your restaurant located?
                </h1>
                <p className="text-base text-[#645d58]">
                  {selectedPlace
                    ? "We've populated your restaurant address and direct phone from Google Places. You can adjust any detail."
                    : "Add your inaugural dining room. You can effortlessly manage satellites, patios, or private salons later."}
                </p>
              </div>

              {/* Form Ledger Card */}
              <div className="w-full max-w-[680px] mx-auto bg-white border border-[#d0c4be] rounded-xl p-8 sm:p-10 shadow-sm mb-10">
                <form id="location-onboarding-form" onSubmit={handleStep2Submit} className="space-y-8">
                  {/* Google Maps Status Banner */}
                  {selectedPlace ? (
                    <div className="p-4 rounded-xl bg-[#faf2ee] border border-[#d0c4be] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className="w-8 h-8 rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-lg font-semibold">check_circle</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-medium text-[#1d1b1a]">Restaurant location found</h3>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#e8e1de] text-[#645d58] border border-[#d0c4be]">
                              <span className="material-symbols-outlined text-xs text-[#1f1f1f]">pin_drop</span>
                              Synced via Google Maps
                            </span>
                          </div>
                          <p className="text-sm text-[#645d58]">
                            We've pre-filled your restaurant address and contact number. You can edit any details below.
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => setActiveStep(1)}
                          className="text-xs text-[#1f1f1f] hover:text-black underline underline-offset-4 cursor-pointer transition-colors"
                        >
                          Change restaurant
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-[#faf2ee] border border-[#d0c4be] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className="w-8 h-8 rounded-full bg-[#1f1f1f]/10 text-[#1f1f1f] flex items-center justify-center shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-lg">edit_note</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <h3 className="text-base font-medium text-[#1d1b1a]">Manual Location Entry</h3>
                          <p className="text-sm text-[#645d58]">
                            Please enter your dining room address and contact phone number.
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => setActiveStep(1)}
                          className="text-xs text-[#1f1f1f] hover:text-black underline underline-offset-4 cursor-pointer transition-colors"
                        >
                          Search on Google
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Section 1: Location Information */}
                  <fieldset className="space-y-5">
                    <legend className="text-xs uppercase tracking-wider text-[#645d58] font-semibold border-b border-[#d0c4be] pb-2 w-full">
                      Location Information
                    </legend>

                    {/* Location Name */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-[#1d1b1a]" htmlFor="location-name">
                        Location Name
                      </label>
                      <input
                        id="location-name"
                        type="text"
                        required
                        className="w-full bg-white border border-[#d0c4be] rounded-lg px-3.5 py-2.5 text-sm text-[#1d1b1a] placeholder:text-[#7f7570] focus:outline-none focus:border-[#1f1f1f] transition-colors"
                        placeholder="e.g. Downtown Flagship"
                        value={locationName}
                        onChange={(e) => setLocationName(e.target.value)}
                      />
                      <span className="text-xs text-[#645d58]">
                        Suggested based on selected restaurant. Keep or customize for internal reporting, guest statements, and receipts.
                      </span>
                    </div>

                    {/* Country */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-[#1d1b1a]" htmlFor="country-select">
                        Country / Region
                      </label>
                      <div className="relative flex items-center">
                        <select
                          id="country-select"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          className="w-full bg-[#faf2ee] border border-[#d0c4be] rounded-lg px-3.5 pr-10 py-2.5 text-sm text-[#1d1b1a] focus:outline-none focus:border-[#1f1f1f] appearance-none cursor-pointer"
                        >
                          <option value="US">United States (US)</option>
                          <option value="IN">India (IN)</option>
                          <option value="CA">Canada (CA)</option>
                          <option value="GB">United Kingdom (GB)</option>
                          <option value="FR">France (FR)</option>
                          <option value="AU">Australia (AU)</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 pointer-events-none text-[#645d58]">
                          unfold_more
                        </span>
                      </div>
                    </div>

                    {/* Street Address & Suite */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-[#1d1b1a]" htmlFor="street-address">
                          Street Address
                        </label>
                        <input
                          id="street-address"
                          type="text"
                          required
                          className="w-full bg-white border border-[#d0c4be] rounded-lg px-3.5 py-2.5 text-sm text-[#1d1b1a] placeholder:text-[#7f7570] focus:outline-none focus:border-[#1f1f1f] transition-colors"
                          placeholder="e.g. 582 Howard Street"
                          value={streetAddress}
                          onChange={(e) => setStreetAddress(e.target.value)}
                        />
                        <p className="text-xs text-[#645d58] mt-1">Full street address of your physical restaurant location.</p>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-[#1d1b1a]" htmlFor="suite-unit">
                          Suite / Floor <span className="text-[#645d58] font-normal">(opt)</span>
                        </label>
                        <input
                          id="suite-unit"
                          type="text"
                          className="w-full bg-white border border-[#d0c4be] rounded-lg px-3.5 py-2.5 text-sm text-[#1d1b1a] placeholder:text-[#7f7570] focus:outline-none focus:border-[#1f1f1f] transition-colors"
                          placeholder="e.g. Suite 200"
                          value={suiteUnit}
                          onChange={(e) => setSuiteUnit(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* City, State, ZIP Compact Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                      <div className="sm:col-span-3 flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-[#1d1b1a]" htmlFor="locality-city">
                          City
                        </label>
                        <input
                          id="locality-city"
                          type="text"
                          required
                          className="w-full bg-white border border-[#d0c4be] rounded-lg px-3.5 py-2.5 text-sm text-[#1d1b1a] placeholder:text-[#7f7570] focus:outline-none focus:border-[#1f1f1f] transition-colors"
                          placeholder="e.g. San Francisco"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-2 flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-[#1d1b1a]" htmlFor="region-state">
                          State / Region
                        </label>
                        <input
                          id="region-state"
                          type="text"
                          required
                          className="w-full bg-white border border-[#d0c4be] rounded-lg px-3 py-2.5 text-sm text-[#1d1b1a] focus:outline-none focus:border-[#1f1f1f]"
                          placeholder="e.g. CA"
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-1 flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-[#1d1b1a]" htmlFor="postal-code">
                          ZIP / PIN
                        </label>
                        <input
                          id="postal-code"
                          type="text"
                          required
                          maxLength={10}
                          className="w-full bg-white border border-[#d0c4be] rounded-lg px-3 py-2.5 text-sm text-[#1d1b1a] placeholder:text-[#7f7570] focus:outline-none focus:border-[#1f1f1f] transition-colors"
                          placeholder="94105"
                          value={zipCode}
                          onChange={(e) => setZipCode(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Phone Number */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-[#1d1b1a]" htmlFor="phone-number">
                        Restaurant Direct Phone
                      </label>
                      <div className="flex rounded-lg overflow-hidden border border-[#d0c4be] focus-within:border-[#1f1f1f] transition-colors">
                        <span className="inline-flex items-center px-3.5 bg-[#faf2ee] text-[#645d58] text-xs border-r border-[#d0c4be] select-none">
                          {country === "IN" ? "+91 (IN)" : country === "GB" ? "+44 (UK)" : "+1 (US)"}
                        </span>
                        <input
                          id="phone-number"
                          type="tel"
                          required
                          className="flex-1 bg-white px-3.5 py-2.5 text-sm text-[#1d1b1a] placeholder:text-[#7f7570] focus:outline-none"
                          placeholder="(555) 000-0000"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                        />
                      </div>
                    </div>
                  </fieldset>

                  {/* Section 2: Regional Preferences */}
                  <fieldset className="space-y-4 pt-2">
                    <div className="flex items-center justify-between border-b border-[#d0c4be] pb-2">
                      <legend className="text-xs uppercase tracking-wider text-[#645d58] font-semibold">
                        Regional Preferences
                      </legend>
                      <span className="text-xs text-[#645d58] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-[#10B981]">check_circle</span>
                        {selectedPlace ? "Configured from Google Places" : "Custom Configuration"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      {/* Currency */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-[#645d58]" htmlFor="currency-select">
                          Settlement Currency
                        </label>
                        <div className="relative">
                          <select
                            id="currency-select"
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="w-full bg-white border border-[#d0c4be] rounded-lg px-3 py-2.5 text-sm text-[#1d1b1a] focus:outline-none focus:border-[#1f1f1f] appearance-none cursor-pointer"
                          >
                            <option value="USD">USD ($) — Dollar</option>
                            <option value="INR">INR (₹) — Rupee</option>
                            <option value="EUR">EUR (€) — Euro</option>
                            <option value="GBP">GBP (£) — Pound</option>
                            <option value="CAD">CAD ($) — CAD</option>
                            <option value="AUD">AUD ($) — AUD</option>
                          </select>
                          <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#645d58] text-sm">
                            expand_more
                          </span>
                        </div>
                      </div>

                      {/* Language */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-[#645d58]" htmlFor="language-select">
                          Primary Language
                        </label>
                        <div className="relative">
                          <select
                            id="language-select"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="w-full bg-white border border-[#d0c4be] rounded-lg px-3 py-2.5 text-sm text-[#1d1b1a] focus:outline-none focus:border-[#1f1f1f] appearance-none cursor-pointer"
                          >
                            <option value="en-US">English (US)</option>
                            <option value="en-IN">English (India)</option>
                            <option value="en-GB">English (UK)</option>
                            <option value="es-US">Spanish (US)</option>
                            <option value="fr-FR">French</option>
                          </select>
                          <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#645d58] text-sm">
                            expand_more
                          </span>
                        </div>
                      </div>

                      {/* Timezone */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-[#645d58]" htmlFor="timezone-select">
                          Service Timezone
                        </label>
                        <div className="relative">
                          <select
                            id="timezone-select"
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            className="w-full bg-white border border-[#d0c4be] rounded-lg px-3 py-2.5 text-sm text-[#1d1b1a] focus:outline-none focus:border-[#1f1f1f] appearance-none cursor-pointer"
                          >
                            <option value="Asia/Kolkata">Asia/Kolkata (IST - India Standard Time)</option>
                            <option value="Asia/Dubai">Asia/Dubai (GST - Gulf Standard Time)</option>
                            <option value="Europe/London">Europe/London (GMT / BST)</option>
                            <option value="Europe/Paris">Europe/Paris (CET)</option>
                            <option value="America/New_York">America/New_York (EST / EDT)</option>
                            <option value="America/Chicago">America/Chicago (CST / CDT)</option>
                            <option value="America/Denver">America/Denver (MST / MDT)</option>
                            <option value="America/Los_Angeles">America/Los_Angeles (PST - Pacific Time)</option>
                            <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                          </select>
                          <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#645d58] text-sm">
                            expand_more
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-[#645d58] italic">
                      Timezone configured for {city || "restaurant location"}. Nightly closeout batch runs at 4:00 AM local time.
                    </p>
                  </fieldset>

                  {/* Action Footer */}
                  <div className="pt-6 border-t border-[#d0c4be] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveStep(1)}
                      className="inline-flex items-center gap-2 border border-[#d0c4be] hover:bg-[#faf2ee] text-[#1d1b1a] text-sm px-6 py-3.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">arrow_back</span>
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={savingStep}
                      className="inline-flex items-center gap-2 bg-[#1f1f1f] hover:bg-neutral-800 text-white text-sm px-8 py-3.5 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
                    >
                      {savingStep ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                          <span>Saving Location...</span>
                        </>
                      ) : (
                        <>
                          <span>Continue to Operations</span>
                          <span className="material-symbols-outlined text-base">arrow_forward</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}

          {/* ================= STEP 3 SCREEN ================= */}
          {activeStep === 3 && (
            <>
              {/* Editorial Title & Header */}
              <div className="text-center max-w-xl mb-8">
                <h1 className="font-serif text-3xl md:text-4xl text-[#1d1b1a] tracking-tight mb-2">
                  How do you serve your customers?
                </h1>
                <p className="text-base text-[#645d58]">
                  Select the hospitality modes your restaurant provides. Fine-tune rules anytime in settings.
                </p>
              </div>

              {/* Centered Form Card */}
              <div className="w-full max-w-[740px] bg-white rounded-xl shadow-xl p-8 sm:p-10 flex flex-col gap-8 relative overflow-hidden mb-10 border border-[#eadfd6]">
                {/* Top Subtle Editorial Accent Line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#eee7e3] via-[#1f1f1f] to-[#eee7e3]"></div>

                {/* Service Modes Multi-Select Grid */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold uppercase tracking-wide text-[#1d1b1a]">
                      Fulfillment Modalities
                    </span>
                    <span className="text-xs text-[#645d58]">Multi-select enabled</span>
                  </div>

                  <div className="flex flex-col gap-3.5">
                    {/* Card 1: Dine-In */}
                    <div
                      onClick={() => setIsDineIn(!isDineIn)}
                      className={`rounded-lg p-5 transition-all cursor-pointer shadow-sm relative border ${
                        isDineIn ? "bg-[#faf2ee] border-[#1f1f1f]" : "bg-white border-[#eadfd6] hover:bg-[#faf2ee]"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3.5">
                          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-[#1f1f1f] shadow-sm shrink-0 border border-[#eadfd6]">
                            <span className="material-symbols-outlined text-2xl">table_restaurant</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-serif text-lg font-medium text-[#1d1b1a]">Dine-In</h3>
                              <span className="px-2 py-0.5 rounded-full bg-[#1f1f1f] text-white text-[11px] leading-tight">
                                Recommended
                              </span>
                            </div>
                            <p className="text-sm text-[#645d58] mt-0.5">
                              Guests visit, experience atmosphere, and dine inside your establishment.
                            </p>
                          </div>
                        </div>
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            isDineIn ? "bg-[#1f1f1f] text-white" : "border border-[#d0c4be] text-transparent"
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm font-bold">check</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Pickup / Takeout */}
                    <div
                      onClick={() => setIsPickup(!isPickup)}
                      className={`rounded-lg p-5 transition-all cursor-pointer shadow-sm relative border ${
                        isPickup ? "bg-[#faf2ee] border-[#1f1f1f]" : "bg-white border-[#eadfd6] hover:bg-[#faf2ee]"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3.5">
                          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-[#1f1f1f] shadow-sm shrink-0 border border-[#eadfd6]">
                            <span className="material-symbols-outlined text-2xl">shopping_bag</span>
                          </div>
                          <div>
                            <h3 className="font-serif text-lg font-medium text-[#1d1b1a]">Pickup &amp; Takeout</h3>
                            <p className="text-sm text-[#645d58] mt-0.5">
                              Guests place orders online, via phone, or at till for prompt collection.
                            </p>
                          </div>
                        </div>
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            isPickup ? "bg-[#1f1f1f] text-white" : "border border-[#d0c4be] text-transparent"
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm font-bold">check</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Direct Delivery */}
                    <div
                      onClick={() => setIsDelivery(!isDelivery)}
                      className={`rounded-lg p-5 transition-all cursor-pointer shadow-sm relative border ${
                        isDelivery ? "bg-[#faf2ee] border-[#1f1f1f]" : "bg-white border-[#eadfd6] hover:bg-[#faf2ee]"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3.5">
                          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-[#1f1f1f] shadow-sm shrink-0 border border-[#eadfd6]">
                            <span className="material-symbols-outlined text-2xl">moped</span>
                          </div>
                          <div>
                            <h3 className="font-serif text-lg font-medium text-[#1d1b1a]">Direct Delivery</h3>
                            <p className="text-sm text-[#645d58] mt-0.5">
                              Dishes and drinks are packaged and dispatched directly to customer addresses.
                            </p>
                          </div>
                        </div>
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            isDelivery ? "bg-[#1f1f1f] text-white" : "border border-[#d0c4be] text-transparent"
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm font-bold">check</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Operating Hours Template */}
                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-[#1d1b1a]">Operating Hours Template</label>
                    <span className="text-sm text-[#645d58]">
                      Set opening intervals for automatic register sync and order cadence.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label
                      onClick={() => setOperatingHours("standard")}
                      className={`flex items-start gap-3 p-3.5 rounded-lg cursor-pointer transition-all border ${
                        operatingHours === "standard"
                          ? "bg-[#faf2ee] border-[#1f1f1f]"
                          : "bg-white border-[#eadfd6] hover:bg-[#faf2ee]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="operating_hours"
                        value="standard"
                        checked={operatingHours === "standard"}
                        onChange={() => setOperatingHours("standard")}
                        className="mt-1 accent-[#1f1f1f] shrink-0"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-[#1d1b1a]">Consistent Daily</span>
                        <span className="text-xs text-[#645d58] mt-0.5">11:00 AM – 10:00 PM throughout the week</span>
                      </div>
                    </label>

                    <label
                      onClick={() => setOperatingHours("custom")}
                      className={`flex items-start gap-3 p-3.5 rounded-lg cursor-pointer transition-all border ${
                        operatingHours === "custom"
                          ? "bg-[#faf2ee] border-[#1f1f1f]"
                          : "bg-white border-[#eadfd6] hover:bg-[#faf2ee]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="operating_hours"
                        value="custom"
                        checked={operatingHours === "custom"}
                        onChange={() => setOperatingHours("custom")}
                        className="mt-1 accent-[#1f1f1f] shrink-0"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-[#1d1b1a]">Custom by Day</span>
                        <span className="text-xs text-[#645d58] mt-0.5">Varying service hours on weekends</span>
                      </div>
                    </label>

                    <label
                      onClick={() => setOperatingHours("later")}
                      className={`flex items-start gap-3 p-3.5 rounded-lg cursor-pointer transition-all border ${
                        operatingHours === "later"
                          ? "bg-[#faf2ee] border-[#1f1f1f]"
                          : "bg-white border-[#eadfd6] hover:bg-[#faf2ee]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="operating_hours"
                        value="later"
                        checked={operatingHours === "later"}
                        onChange={() => setOperatingHours("later")}
                        className="mt-1 accent-[#1f1f1f] shrink-0"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-[#1d1b1a]">Defer Schedule</span>
                        <span className="text-xs text-[#645d58] mt-0.5">Finalize in PREST Control Room</span>
                      </div>
                    </label>
                  </div>

                  {/* Custom Schedule Details Drawer/Panel when "Custom by Day" is selected */}
                  {operatingHours === "custom" && (
                    <div className="p-4 bg-[#faf2ee] border border-[#eadfd6] rounded-xl space-y-3.5 mt-1 transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#1d1b1a] uppercase tracking-wider">
                          Configure Weekend vs Weekday Shifts
                        </span>
                        <span className="text-[11px] text-[#645d58]">Syncs with Settings &gt; Operational Timings</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Weekday Shift */}
                        <div className="bg-white p-3.5 rounded-lg border border-[#eadfd6] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-[#1d1b1a]">Mon – Fri (Weekdays)</span>
                            <span className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded font-medium">Open</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <label className="text-[10px] text-[#645d58] block mb-0.5">Start Time</label>
                              <input
                                type="time"
                                value={customSchedule.weekdayStart}
                                onChange={(e) => setCustomSchedule({ ...customSchedule, weekdayStart: e.target.value })}
                                className="w-full text-xs bg-[#faf2ee] border border-[#eadfd6] rounded px-2 py-1.5 text-[#1d1b1a] focus:outline-none"
                              />
                            </div>
                            <span className="text-xs text-[#645d58] mt-3.5">—</span>
                            <div className="flex-1">
                              <label className="text-[10px] text-[#645d58] block mb-0.5">End Time</label>
                              <input
                                type="time"
                                value={customSchedule.weekdayEnd}
                                onChange={(e) => setCustomSchedule({ ...customSchedule, weekdayEnd: e.target.value })}
                                className="w-full text-xs bg-[#faf2ee] border border-[#eadfd6] rounded px-2 py-1.5 text-[#1d1b1a] focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Weekend Shift */}
                        <div className="bg-white p-3.5 rounded-lg border border-[#eadfd6] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-[#1d1b1a]">Sat – Sun (Weekends)</span>
                            <span className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded font-medium">Open</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <label className="text-[10px] text-[#645d58] block mb-0.5">Start Time</label>
                              <input
                                type="time"
                                value={customSchedule.weekendStart}
                                onChange={(e) => setCustomSchedule({ ...customSchedule, weekendStart: e.target.value })}
                                className="w-full text-xs bg-[#faf2ee] border border-[#eadfd6] rounded px-2 py-1.5 text-[#1d1b1a] focus:outline-none"
                              />
                            </div>
                            <span className="text-xs text-[#645d58] mt-3.5">—</span>
                            <div className="flex-1">
                              <label className="text-[10px] text-[#645d58] block mb-0.5">End Time</label>
                              <input
                                type="time"
                                value={customSchedule.weekendEnd}
                                onChange={(e) => setCustomSchedule({ ...customSchedule, weekendEnd: e.target.value })}
                                className="w-full text-xs bg-[#faf2ee] border border-[#eadfd6] rounded px-2 py-1.5 text-[#1d1b1a] focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Callout */}
                <div className="bg-[#faf2ee] rounded-lg p-4 flex items-start gap-3.5 text-[#1d1b1a] border border-[#eadfd6]">
                  <span className="material-symbols-outlined text-[#1f1f1f] text-xl shrink-0 mt-0.5">info</span>
                  <p className="text-sm text-[#4d4541] leading-relaxed">
                    Kitchen display routing, terminal printer mappings, and merchant rate cards can be finalized seamlessly inside your management console post-launch.
                  </p>
                </div>

                {/* Action Footer */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="px-6 py-3.5 rounded-lg bg-[#faf2ee] hover:bg-[#eee7e3] text-sm font-medium text-[#1d1b1a] transition-colors flex items-center gap-2 cursor-pointer border border-[#eadfd6]"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    <span>Back</span>
                  </button>
                  <button
                    id="submit-onboarding"
                    type="button"
                    disabled={savingStep}
                    onClick={handleStep3Submit}
                    className="px-8 py-3.5 rounded-lg bg-[#1f1f1f] hover:bg-neutral-800 text-white text-sm font-medium transition-all shadow-md flex items-center gap-2.5 cursor-pointer"
                  >
                    {savingStep ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                        <span>Configuring Registers...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Organisation &amp; Start PREST</span>
                        <span className="material-symbols-outlined text-sm">bolt</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ================= STEP 4 SCREEN: LAUNCH CHECKLIST ================= */}
          {activeStep === 4 && (
            <OnboardingLaunchChecklist
              organizationId={activeOrg?._id}
              orgName={orgName}
              restName={restName}
              userFullName={user?.fullName || undefined}
            />
          )}
        </div>
      </main>
    </div>
  );
}
