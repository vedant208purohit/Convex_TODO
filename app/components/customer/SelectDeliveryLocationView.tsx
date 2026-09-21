"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  CustomerOrganization,
  CustomerTable,
  DeliveryAddress,
  AddressType,
} from "./types";
import { useCustomerCart } from "./CustomerCartContext";
import {
  ArrowBackIcon,
  LocationPinIcon,
  DeliveryTargetPinIcon,
  GpsCrosshairIcon,
  ClearCircleIcon,
  HomeAddressIcon,
  OfficeAddressIcon,
  OtherAddressIcon,
  ArrowForwardIcon,
  VerifiedCheckIcon,
  SearchIcon,
} from "./CustomerIcons";

interface SelectDeliveryLocationViewProps {
  organization: CustomerOrganization;
  table?: CustomerTable;
  onBack: () => void;
  onConfirmLocation: (address: DeliveryAddress) => void;
}

// Pre-defined known area suggestions for fast, realistic search & selection
interface LocationSuggestion {
  title: string;
  subtitle: string;
  area: string;
  city: string;
  zipCode: string;
  latitude: number;
  longitude: number;
}

const SAMPLE_LOCATION_SUGGESTIONS: LocationSuggestion[] = [
  {
    title: "Titanium Heights",
    subtitle: "Corporate Road, Opposite Vodafone House, Makarba",
    area: "Titanium Heights, Corporate Road, Makarba",
    city: "Ahmedabad",
    zipCode: "380015",
    latitude: 22.9988,
    longitude: 72.5074,
  },
  {
    title: "Prahlad Nagar Trade Center",
    subtitle: "Prahlad Nagar Road, Near Anandnagar",
    area: "Prahlad Nagar Trade Center, Anandnagar",
    city: "Ahmedabad",
    zipCode: "380015",
    latitude: 23.0125,
    longitude: 72.5118,
  },
  {
    title: "Sarkhej Roza Heritage Precinct",
    subtitle: "Makarba Gam, Sarkhej",
    area: "Makarba Gam, Sarkhej",
    city: "Ahmedabad",
    zipCode: "380055",
    latitude: 22.9818,
    longitude: 72.5015,
  },
  {
    title: "TRP Mall & Commercial Hub",
    subtitle: "Bopal-Ambli Road, Near Iscon Cross Roads",
    area: "Bopal-Ambli Road",
    city: "Ahmedabad",
    zipCode: "380058",
    latitude: 23.0335,
    longitude: 72.4842,
  },
  {
    title: "Sundarvan Ecology Park & Nature Center",
    subtitle: "Jodhpur Tekra, Satellite",
    area: "Jodhpur Tekra, Satellite",
    city: "Ahmedabad",
    zipCode: "380015",
    latitude: 23.0242,
    longitude: 72.5276,
  },
];

const QUICK_DELIVERY_CHIPS = [
  { id: "gate", label: "🚪 Leave at gate", text: "Leave at gate" },
  { id: "avoid_call", label: "🤫 Avoid calling", text: "Avoid calling" },
  { id: "guard", label: "🛡️ With guard", text: "Leave with security guard" },
  { id: "bell", label: "🔔 Ring bell", text: "Ring bell twice" },
];

export function SelectDeliveryLocationView({
  organization,
  table,
  onBack,
  onConfirmLocation,
}: SelectDeliveryLocationViewProps) {
  const {
    deliveryAddress,
    setDeliveryAddress,
    customerPhone,
    setServiceMode,
  } = useCustomerCart();

  // Search and Map View States
  const [searchQuery, setSearchQuery] = useState(
    deliveryAddress?.apartmentRoadArea
      ? `${deliveryAddress.apartmentRoadArea}`
      : "Titanium Heights, Corporate Road, Makarba"
  );
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [mapMode, setMapMode] = useState<"map" | "satellite">("map");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [accuracyStatus, setAccuracyStatus] = useState<"High Accuracy" | "Approximate" | "Manual">(
    deliveryAddress?.accuracyStatus || "High Accuracy"
  );

  // Form Field States
  const [houseFlatBlock, setHouseFlatBlock] = useState(
    deliveryAddress?.houseFlatBlock || "D-73"
  );
  const [apartmentRoadArea, setApartmentRoadArea] = useState(
    deliveryAddress?.apartmentRoadArea || "Titanium Heights, Corporate Road, Makarba"
  );
  const [deliveryInstructions, setDeliveryInstructions] = useState(
    deliveryAddress?.deliveryInstructions || "Call before ringing bell"
  );
  const [landmark, setLandmark] = useState(
    deliveryAddress?.landmark || "Near Vodafone House, opposite courtyard"
  );
  const [addressType, setAddressType] = useState<AddressType>(
    deliveryAddress?.addressType || "Home"
  );
  const [formattedAddress, setFormattedAddress] = useState(
    deliveryAddress?.formattedAddress || "Makarba, Ahmedabad, Gujarat 380015"
  );
  const [coordinates, setCoordinates] = useState<{ lat?: number; lng?: number }>({
    lat: deliveryAddress?.latitude || 22.9988,
    lng: deliveryAddress?.longitude || 72.5074,
  });

  // Validation Error States
  const [errors, setErrors] = useState<{
    houseFlatBlock?: string;
    apartmentRoadArea?: string;
  }>({});

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter location suggestions based on user input
  const filteredSuggestions = SAMPLE_LOCATION_SUGGESTIONS.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.subtitle.toLowerCase().includes(q) ||
      s.area.toLowerCase().includes(q)
    );
  });

  // Handle GPS Current Location fetch
  const handleUseCurrentLocation = () => {
    setGpsLoading(true);
    setGpsError(null);

    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsLoading(false);
      setGpsError("Geolocation is not supported by your browser or device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCoordinates({ lat: latitude, lng: longitude });
        setAccuracyStatus(accuracy && accuracy < 50 ? "High Accuracy" : "Approximate");

        // Set realistic resolved location values
        const resolvedArea = "Corporate Road, Makarba";
        const resolvedFormatted = `Makarba, Ahmedabad, Gujarat 380015`;

        setApartmentRoadArea((prev) => (prev ? prev : resolvedArea));
        setFormattedAddress(resolvedFormatted);
        setSearchQuery(resolvedArea);
        setGpsLoading(false);
      },
      (error) => {
        setGpsLoading(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsError("Location permission denied. Please search or enter address manually.");
        } else if (error.code === error.TIMEOUT) {
          setGpsError("Location request timed out. Please try again or search manually.");
        } else {
          setGpsError("Unable to retrieve your current location. Please search manually.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  // Select a suggestion from search dropdown
  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    setApartmentRoadArea(suggestion.area);
    setFormattedAddress(`${suggestion.area}, ${suggestion.city} ${suggestion.zipCode}`);
    setSearchQuery(suggestion.area);
    setCoordinates({ lat: suggestion.latitude, lng: suggestion.longitude });
    setAccuracyStatus("High Accuracy");
    setIsSearchFocused(false);
    if (errors.apartmentRoadArea) {
      setErrors((prev) => ({ ...prev, apartmentRoadArea: undefined }));
    }
  };

  // Quick delivery chip toggle/append
  const handleToggleChip = (chipText: string) => {
    setDeliveryInstructions((prev) => {
      if (!prev.trim()) return chipText;
      if (prev.includes(chipText)) {
        return prev.replace(chipText, "").replace(/,\s*,/g, ",").replace(/^,\s*|,\s*$/g, "").trim();
      }
      return `${prev.trim()}, ${chipText}`;
    });
  };

  // Adjust location button action
  const handleAdjustLocation = () => {
    searchInputRef.current?.focus();
    setIsSearchFocused(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Form Validation and Confirmation
  const handleConfirmAddress = () => {
    const newErrors: { houseFlatBlock?: string; apartmentRoadArea?: string } = {};

    if (!houseFlatBlock.trim()) {
      newErrors.houseFlatBlock = "Please enter house / flat / block number";
    }
    if (!apartmentRoadArea.trim()) {
      newErrors.apartmentRoadArea = "Please enter apartment / road / area";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Scroll to the first error input
      const firstErrorEl = document.getElementById(
        newErrors.houseFlatBlock ? "flat-block-input" : "apartment-road-input"
      );
      if (firstErrorEl) {
        firstErrorEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    const compiledAddress: DeliveryAddress = {
      houseFlatBlock: houseFlatBlock.trim(),
      apartmentRoadArea: apartmentRoadArea.trim(),
      deliveryInstructions: deliveryInstructions.trim() || undefined,
      landmark: landmark.trim() || undefined,
      addressType,
      city: "Ahmedabad",
      zipCode: "380015",
      formattedAddress:
        formattedAddress || `${apartmentRoadArea.trim()}, Ahmedabad 380015`,
      latitude: coordinates.lat,
      longitude: coordinates.lng,
      accuracyStatus,
      isDefault: true,
    };

    // 1. Persist to Cart Context
    setDeliveryAddress(compiledAddress);
    // 2. Lock service mode to Delivery
    setServiceMode("delivery");
    // 3. Trigger callback to return to Delivery Cart / Screen 3A
    onConfirmLocation(compiledAddress);
  };

  const currentAreaTag = formattedAddress.split(",").slice(0, 2).join(",").trim() || "Makarba, Ahmedabad";

  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col shadow-2xl relative overflow-x-hidden border-x border-slate-200 antialiased font-sans">
      {/* ========================================================================= */}
      {/* 1. TOP BAR & SEARCH HEADER (Sticky)                                        */}
      {/* ========================================================================= */}
      <header className="bg-[#4338ca] text-white pt-3 pb-4 px-4 sticky top-0 z-30 shadow-md">
        {/* Top Row: Back button, Title & Area badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <button
              aria-label="Go back to previous screen"
              onClick={onBack}
              type="button"
              className="p-1.5 -ml-1.5 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer"
            >
              <ArrowBackIcon className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-base font-semibold tracking-tight text-white">
              Select delivery location
            </h1>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium bg-[#3730a3]/80 text-[#e0e7ff] px-2.5 py-1 rounded-full border border-[#4f46e5] truncate max-w-[170px]">
            <LocationPinIcon className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />
            <span className="truncate">{currentAreaTag}</span>
          </span>
        </div>

        {/* Search Input Box */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <SearchIcon className="w-4 h-4 text-slate-400" />
          </div>
          <input
            ref={searchInputRef}
            id="location-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            placeholder="Search area, street, building or landmark..."
            className="w-full bg-white text-slate-900 placeholder-slate-400 text-xs sm:text-sm rounded-lg pl-9 pr-8 py-2.5 shadow-sm border-0 focus:ring-2 focus:ring-indigo-400 font-medium truncate"
          />
          {searchQuery && (
            <button
              aria-label="Clear search input"
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
              type="button"
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <ClearCircleIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Suggestions Autocomplete Dropdown */}
        {isSearchFocused && filteredSuggestions.length > 0 && (
          <div className="absolute left-4 right-4 top-[108px] bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden max-h-60 overflow-y-auto no-scrollbar animate-fade-in">
            <div className="p-2 border-b border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>Suggested Locations</span>
              <button
                type="button"
                onClick={() => setIsSearchFocused(false)}
                className="text-[#4338ca] hover:underline cursor-pointer"
              >
                Close
              </button>
            </div>
            {filteredSuggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSuggestion(s)}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-start gap-2.5 transition-colors cursor-pointer"
              >
                <div className="p-1 rounded-full bg-indigo-50 text-[#4338ca] mt-0.5 flex-shrink-0">
                  <LocationPinIcon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {s.title}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {s.subtitle}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Quick GPS Fetch Action Button */}
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={gpsLoading}
          className="w-full mt-2.5 bg-[#3730a3]/90 hover:bg-[#3730a3] active:bg-[#312e81] border border-[#6366f1]/50 rounded-lg px-3 py-2 flex items-center justify-between transition-all cursor-pointer"
        >
          <div className="flex items-center space-x-2.5 text-left">
            <div className="w-6 h-6 rounded-full bg-[#4f46e5] flex items-center justify-center flex-shrink-0">
              <GpsCrosshairIcon className={`w-4 h-4 text-emerald-300 ${gpsLoading ? "animate-spin" : ""}`} />
            </div>
            <div>
              <div className="text-xs font-semibold text-white tracking-wide flex items-center gap-1.5">
                <span>{gpsLoading ? "Locating you..." : "Use my current location"}</span>
              </div>
              <div className="text-[10px] text-[#e0e7ff]">
                Using GPS for doorstep accuracy
              </div>
            </div>
          </div>
          <svg className="w-4 h-4 text-[#e0e7ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </button>

        {gpsError && (
          <div className="mt-2 text-[11px] text-rose-200 bg-rose-950/60 border border-rose-500/40 px-2.5 py-1.5 rounded-lg flex items-center justify-between">
            <span>{gpsError}</span>
            <button
              type="button"
              onClick={() => setGpsError(null)}
              className="text-white hover:underline text-[10px] ml-2"
            >
              Dismiss
            </button>
          </div>
        )}
      </header>

      {/* ========================================================================= */}
      {/* 2. MAP INTERACTIVE CANVAS SECTION                                          */}
      {/* ========================================================================= */}
      <div
        className={`relative w-full h-80 overflow-hidden select-none border-b border-slate-300 ${
          mapMode === "satellite" ? "map-satellite-bg" : "map-grid-bg"
        }`}
        data-purpose="map-viewport"
      >
        {/* SVG Vector Map Rendering */}
        <svg
          className="w-full h-full object-cover"
          fill="none"
          viewBox="0 0 400 320"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect fill={mapMode === "satellite" ? "#1e293b" : "#E8ECE9"} width="400" height="320" />

          {/* Water Body hint */}
          <path
            d="M260 320 C 270 290, 295 270, 310 250 C 330 220, 350 200, 400 190 L 400 320 Z"
            fill={mapMode === "satellite" ? "#0369a1" : "#BAE6FD"}
            opacity={mapMode === "satellite" ? "0.4" : "0.6"}
          />

          {/* Parks & Green areas */}
          <rect
            x="290"
            y="110"
            width="70"
            height="40"
            rx="6"
            fill={mapMode === "satellite" ? "#14532d" : "#DCFCE7"}
            opacity={mapMode === "satellite" ? "0.6" : "1"}
          />
          <text
            x="325"
            y="134"
            fill={mapMode === "satellite" ? "#86efac" : "#166534"}
            fontSize="7"
            fontWeight="600"
            textAnchor="middle"
          >
            Sundarvan
          </text>
          <path
            d="M 10 70 Q 30 60 50 80 T 90 90 L 80 140 L 20 130 Z"
            fill={mapMode === "satellite" ? "#14532d" : "#DCFCE7"}
            opacity={mapMode === "satellite" ? "0.4" : "0.75"}
          />

          {/* Major Highway (S.G. Highway / NH 147) */}
          <path d="M -10 240 L 420 175" stroke="#FDE047" strokeWidth="9" strokeLinecap="round" />
          <path d="M -10 240 L 420 175" stroke="#EAB308" strokeWidth="2" strokeDasharray="6 4" />
          <text
            x="210"
            y="198"
            fill="#854d0e"
            fontSize="8"
            fontWeight="bold"
            transform="rotate(-9, 210, 198)"
          >
            S.G. HIGHWAY (NH 147)
          </text>

          {/* Secondary Arterials (Corporate Road, Makarba Road) */}
          <path d="M 120 -10 L 195 330" stroke={mapMode === "satellite" ? "#475569" : "#FFFFFF"} strokeWidth="7" />
          <path d="M 120 -10 L 195 330" stroke={mapMode === "satellite" ? "#64748b" : "#CBD5E1"} strokeWidth="1.5" />
          <path d="M -20 100 L 420 70" stroke={mapMode === "satellite" ? "#475569" : "#FFFFFF"} strokeWidth="6" />
          <path d="M 60 270 L 380 90" stroke={mapMode === "satellite" ? "#475569" : "#FFFFFF"} strokeWidth="5" />
          <path d="M 40 180 Q 200 160 380 250" stroke={mapMode === "satellite" ? "#475569" : "#FFFFFF"} strokeWidth="4.5" />

          {/* Local Streets */}
          <path d="M 180 80 L 240 160 L 330 180" stroke={mapMode === "satellite" ? "#334155" : "#E2E8F0"} strokeWidth="3" />
          <path d="M 80 40 L 170 120" stroke={mapMode === "satellite" ? "#334155" : "#E2E8F0"} strokeWidth="2.5" />
          <path d="M 130 190 L 230 250" stroke={mapMode === "satellite" ? "#334155" : "#E2E8F0"} strokeWidth="2.5" />

          {/* Road Labels */}
          <text
            x="175"
            y="240"
            fill={mapMode === "satellite" ? "#cbd5e1" : "#64748B"}
            fontSize="6.5"
            fontWeight="600"
            transform="rotate(75, 175, 240)"
          >
            Corporate Road
          </text>
          <text
            x="50"
            y="95"
            fill={mapMode === "satellite" ? "#cbd5e1" : "#64748B"}
            fontSize="6.5"
            fontWeight="600"
          >
            Prahlad Nagar Ext.
          </text>
          <text
            x="230"
            y="270"
            fill={mapMode === "satellite" ? "#cbd5e1" : "#475569"}
            fontSize="7"
            fontWeight="600"
          >
            Makarba Gam
          </text>

          {/* Landmarks & Points of Interest */}
          <g transform="translate(60, 115)">
            <circle cx="8" cy="8" r="8" fill="#38BDF8" />
            <text x="8" y="11" fill="#ffffff" fontSize="7" textAnchor="middle">
              🛍️
            </text>
            <text x="20" y="11" fill={mapMode === "satellite" ? "#7dd3fc" : "#0369a1"} fontSize="6.5" fontWeight="bold">
              TRP Mall
            </text>
          </g>
          <g transform="translate(210, 100)">
            <circle cx="8" cy="8" r="8" fill="#FB923C" />
            <text x="8" y="11" fill="#ffffff" fontSize="7" textAnchor="middle">
              🍲
            </text>
            <text x="20" y="10" fill={mapMode === "satellite" ? "#fdba74" : "#9a3412"} fontSize="6" fontWeight="bold">
              Gordhan Thal
            </text>
          </g>
          <g transform="translate(190, 205)">
            <circle cx="8" cy="8" r="8" fill="#818CF8" />
            <text x="8" y="11" fill="#ffffff" fontSize="7" textAnchor="middle">
              🕌
            </text>
            <text x="20" y="11" fill={mapMode === "satellite" ? "#c7d2fe" : "#3730A3"} fontSize="6" fontWeight="bold">
              Sarkhej Roza
            </text>
          </g>

          {/* Highlighted Building Footprint */}
          <rect
            x="182"
            y="132"
            width="34"
            height="24"
            rx="2"
            fill={mapMode === "satellite" ? "#312e81" : "#C7D2FE"}
            stroke="#6366F1"
            strokeWidth="1.5"
          />
          <text x="199" y="146" fill={mapMode === "satellite" ? "#e0e7ff" : "#3730A3"} fontSize="5" fontWeight="bold" textAnchor="middle">
            TITANIUM
          </text>
          <text x="199" y="152" fill={mapMode === "satellite" ? "#a5b4fc" : "#4338CA"} fontSize="4.5" textAnchor="middle">
            HEIGHTS
          </text>
        </svg>

        {/* Map Mode Controls (Map / Satellite Toggle) */}
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-slate-200 p-0.5 flex text-xs font-semibold z-10">
          <button
            type="button"
            onClick={() => setMapMode("map")}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              mapMode === "map"
                ? "bg-[#4338ca] text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Map
          </button>
          <button
            type="button"
            onClick={() => setMapMode("satellite")}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              mapMode === "satellite"
                ? "bg-[#4338ca] text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Satellite
          </button>
        </div>

        {/* Floating GPS Target / Re-center Button ("Find Me") */}
        <div className="absolute bottom-3 right-3 z-10">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            aria-label="Find me on map"
            className="flex items-center space-x-1.5 bg-white/95 backdrop-blur-sm hover:bg-white text-slate-800 text-xs font-semibold px-3 py-2 rounded-xl shadow-lg border border-slate-200 active:scale-95 transition-all cursor-pointer"
          >
            <GpsCrosshairIcon className="w-4 h-4 text-[#4338ca]" />
            <span>Find Me</span>
          </button>
        </div>

        {/* Centered Interactive Delivery Pin & Tooltip Callout */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center -translate-y-4 z-20">
          {/* Callout Bubble */}
          <div className="bg-slate-900/90 text-white px-3 py-1.5 rounded-lg shadow-xl text-center flex flex-col items-center animate-bounce duration-700 mb-1 border border-slate-700 backdrop-blur-sm">
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-[11px] font-bold text-white tracking-wide">
                Order delivered here
              </span>
            </div>
            <span className="text-[10px] text-slate-300 font-medium truncate max-w-[190px]">
              {apartmentRoadArea || "Titanium Heights, Makarba"}
            </span>
            <div className="w-2 h-2 bg-slate-900/90 rotate-45 -mb-2.5 mt-0.5"></div>
          </div>

          {/* Delivery Pin Graphic & Pulsing Ring */}
          <div className="relative flex items-center justify-center">
            <div className="w-7 h-7 rounded-full bg-[#4f46e5]/30 pin-pulse absolute"></div>
            <DeliveryTargetPinIcon className="w-9 h-9 text-[#4338ca] drop-shadow-lg z-10 -mt-1" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. ADDRESS DETAILS SHEET (Scrollable)                                      */}
      {/* ========================================================================= */}
      <main className="flex-1 bg-white rounded-t-2xl -mt-3 relative z-10 px-4 pt-3.5 pb-36 shadow-2xl space-y-4">
        {/* Mobile sheet drag handle indicator */}
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-1"></div>

        {/* Detected Location Banner */}
        <section
          className="bg-[#eef2ff]/80 border border-[#e0e7ff] rounded-xl p-3 flex items-start justify-between"
          data-purpose="detected-location-badge"
        >
          <div className="flex items-start space-x-2.5 min-w-0 flex-1">
            <div className="p-1.5 rounded-lg bg-[#e0e7ff] text-[#4338ca] mt-0.5 flex-shrink-0">
              <LocationPinIcon className="w-4 h-4 text-[#4338ca]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#4338ca]">
                  Detected Location
                </span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  ✓ {accuracyStatus}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-800 mt-0.5 break-words">
                {formattedAddress}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAdjustLocation}
            className="text-xs font-bold text-[#4338ca] hover:text-[#3730a3] underline ml-2 pt-0.5 flex-shrink-0 cursor-pointer"
          >
            Adjust
          </button>
        </section>

        {/* Section Heading & Delivery Tag */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Add address details</h2>
            <p className="text-[11px] text-slate-500">
              Help delivery partner reach your doorstep quickly
            </p>
          </div>
          <span className="text-[11px] font-medium text-[#4338ca] bg-[#eef2ff] px-2 py-1 rounded-md border border-[#c7d2fe]">
            Doorstep Delivery
          </span>
        </div>

        {/* Address Input Form */}
        <form
          className="space-y-3.5 text-xs"
          id="address-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirmAddress();
          }}
        >
          {/* Field 1: House / Flat / Block no. (Required) */}
          <div>
            <label
              htmlFor="flat-block-input"
              className="block font-semibold text-slate-700 mb-1"
            >
              House / Flat / Block no. <span className="text-rose-500">*</span>
            </label>
            <input
              id="flat-block-input"
              type="text"
              required
              value={houseFlatBlock}
              onChange={(e) => {
                setHouseFlatBlock(e.target.value);
                if (errors.houseFlatBlock) {
                  setErrors((prev) => ({ ...prev, houseFlatBlock: undefined }));
                }
              }}
              placeholder="e.g. 402, 4th Floor, Block B"
              className={`w-full text-xs font-medium text-slate-800 bg-white border rounded-lg px-3 py-2.5 focus:border-[#4338ca] focus:ring-1 focus:ring-[#4338ca] ${
                errors.houseFlatBlock ? "border-rose-500 ring-1 ring-rose-500" : "border-slate-300"
              }`}
            />
            {errors.houseFlatBlock && (
              <p className="text-[11px] text-rose-600 font-medium mt-1">
                {errors.houseFlatBlock}
              </p>
            )}
          </div>

          {/* Field 2: Apartment / Road / Area (Required) */}
          <div>
            <label
              htmlFor="apartment-road-input"
              className="block font-semibold text-slate-700 mb-1"
            >
              Apartment / Road / Area <span className="text-rose-500">*</span>
            </label>
            <input
              id="apartment-road-input"
              type="text"
              required
              value={apartmentRoadArea}
              onChange={(e) => {
                setApartmentRoadArea(e.target.value);
                if (errors.apartmentRoadArea) {
                  setErrors((prev) => ({ ...prev, apartmentRoadArea: undefined }));
                }
              }}
              placeholder="e.g. Titanium Heights, Corporate Rd"
              className={`w-full text-xs font-medium text-slate-800 bg-white border rounded-lg px-3 py-2.5 focus:border-[#4338ca] focus:ring-1 focus:ring-[#4338ca] ${
                errors.apartmentRoadArea ? "border-rose-500 ring-1 ring-rose-500" : "border-slate-300"
              }`}
            />
            {errors.apartmentRoadArea && (
              <p className="text-[11px] text-rose-600 font-medium mt-1">
                {errors.apartmentRoadArea}
              </p>
            )}
          </div>

          {/* Field 3: Delivery Instructions & Quick Action Chips */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="delivery-notes" className="block font-semibold text-slate-700">
                Delivery instructions <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <span className="text-[10px] text-[#4f46e5] font-medium">For rider safety</span>
            </div>

            {/* Horizontally Scrollable Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
              {QUICK_DELIVERY_CHIPS.map((chip) => {
                const isActive = deliveryInstructions.includes(chip.text);
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => handleToggleChip(chip.text)}
                    className={`whitespace-nowrap px-2.5 py-1 text-[11px] rounded-full border font-medium transition-colors cursor-pointer ${
                      isActive
                        ? "border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3] font-semibold"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            <input
              id="delivery-notes"
              type="text"
              value={deliveryInstructions}
              onChange={(e) => setDeliveryInstructions(e.target.value)}
              placeholder="Any specific gate code or directions"
              className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-2 focus:border-[#4338ca] focus:ring-1 focus:ring-[#4338ca] mt-1"
            />
          </div>

          {/* Field 4: Landmark / Extra details (Optional) */}
          <div>
            <label htmlFor="extra-details" className="block font-semibold text-slate-700 mb-1">
              Landmark / Extra notes
            </label>
            <input
              id="extra-details"
              type="text"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="e.g. Near club house or entry gate 2"
              className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-2 focus:border-[#4338ca] focus:ring-1 focus:ring-[#4338ca]"
            />
          </div>

          {/* Field 5: Save Address As (Home / Office / Other) */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Save address as <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {/* Home Option */}
              <button
                type="button"
                onClick={() => setAddressType("Home")}
                className={`flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                  addressType === "Home"
                    ? "border-2 border-[#4338ca] bg-[#4338ca] text-white shadow-sm"
                    : "border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <HomeAddressIcon className={`w-4 h-4 ${addressType === "Home" ? "text-white" : "text-slate-500"}`} />
                <span>Home</span>
              </button>

              {/* Office Option */}
              <button
                type="button"
                onClick={() => setAddressType("Office")}
                className={`flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                  addressType === "Office"
                    ? "border-2 border-[#4338ca] bg-[#4338ca] text-white shadow-sm"
                    : "border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <OfficeAddressIcon className={`w-4 h-4 ${addressType === "Office" ? "text-white" : "text-slate-500"}`} />
                <span>Office</span>
              </button>

              {/* Other Option */}
              <button
                type="button"
                onClick={() => setAddressType("Other")}
                className={`flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                  addressType === "Other"
                    ? "border-2 border-[#4338ca] bg-[#4338ca] text-white shadow-sm"
                    : "border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <OtherAddressIcon className={`w-4 h-4 ${addressType === "Other" ? "text-white" : "text-slate-500"}`} />
                <span>Other</span>
              </button>
            </div>
          </div>
        </form>
      </main>

      {/* ========================================================================= */}
      {/* 4. STICKY BOTTOM CONFIRMATION CTA                                          */}
      {/* ========================================================================= */}
      <footer className="fixed bottom-0 max-w-md w-full bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] pb-safe">
        <button
          type="button"
          onClick={handleConfirmAddress}
          className="w-full bg-[#4338ca] hover:bg-[#3730a3] active:bg-[#312e81] text-white font-bold text-sm py-3.5 px-4 rounded-xl shadow-md active:scale-[0.99] transition-all flex items-center justify-center space-x-2 cursor-pointer"
        >
          <span>Confirm Location & Return to Cart</span>
          <ArrowForwardIcon className="w-4 h-4 text-[#e0e7ff]" />
        </button>

        <div className="mt-1.5 flex items-center justify-center space-x-1.5 text-[11px] text-slate-500">
          <VerifiedCheckIcon className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
          <span className="truncate">
            Saved to <strong>+91 {customerPhone || "9876543210"}</strong> • Used for future orders
          </span>
        </div>
      </footer>
    </div>
  );
}
