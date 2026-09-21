"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  GoogleMap,
  Marker,
  Autocomplete,
  useJsApiLoader,
  Libraries,
} from "@react-google-maps/api";
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

const GOOGLE_MAPS_LIBRARIES: Libraries = ["places"];

const mapContainerStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
};

// Default fallback coordinates (default city center if no GPS/address is provided yet)
const DEFAULT_CENTER = {
  lat: 22.9988,
  lng: 72.5074,
};

const QUICK_DELIVERY_CHIPS = [
  { id: "gate", label: "🚪 Leave at gate", text: "Leave at gate" },
  { id: "avoid_call", label: "🤫 Avoid calling", text: "Avoid calling" },
  { id: "guard", label: "🛡️ With guard", text: "Leave with security guard" },
  { id: "bell", label: "🔔 Ring bell", text: "Ring bell twice" },
];

interface ParsedAddressComponents {
  formattedAddress: string;
  premise?: string;
  streetNumber?: string;
  streetName?: string;
  area?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  landmark?: string;
}

function parseGoogleAddressComponents(
  components: google.maps.GeocoderAddressComponent[] = [],
  formatted_address = ""
): ParsedAddressComponents {
  const result: ParsedAddressComponents = {
    formattedAddress: formatted_address,
  };

  components.forEach((component) => {
    const types = component.types || [];

    if (types.includes("premise") || types.includes("subpremise")) {
      result.premise = component.long_name;
    }
    if (types.includes("street_number")) {
      result.streetNumber = component.long_name;
    }
    if (types.includes("route")) {
      result.streetName = component.long_name;
    }
    if (
      types.includes("sublocality_level_1") ||
      types.includes("sublocality") ||
      types.includes("neighborhood")
    ) {
      result.area = component.long_name;
    }
    if (types.includes("locality")) {
      result.city = component.long_name;
    } else if (!result.city && types.includes("administrative_area_level_2")) {
      result.city = component.long_name;
    }
    if (types.includes("administrative_area_level_1")) {
      result.state = component.short_name;
    }
    if (types.includes("country")) {
      result.country = component.long_name;
    }
    if (types.includes("postal_code")) {
      result.zipCode = component.long_name;
    }
    if (types.includes("landmark") || types.includes("point_of_interest")) {
      result.landmark = component.long_name;
    }
  });

  return result;
}

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

  const googleApiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY || "";

  // Load Google Maps JavaScript API with places library
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: googleApiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Coordinates and Position
  const [position, setPosition] = useState<{ lat: number; lng: number }>({
    lat: deliveryAddress?.latitude || DEFAULT_CENTER.lat,
    lng: deliveryAddress?.longitude || DEFAULT_CENTER.lng,
  });
  const [mapZoom, setMapZoom] = useState(16);
  const [mapMode, setMapMode] = useState<"map" | "satellite">("map");

  // Search and Geocoding States
  const [searchQuery, setSearchQuery] = useState(
    deliveryAddress?.apartmentRoadArea || deliveryAddress?.formattedAddress || ""
  );
  const [isGeocodingLoading, setIsGeocodingLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [accuracyStatus, setAccuracyStatus] = useState<"High Accuracy" | "Approximate" | "Manual">(
    deliveryAddress?.accuracyStatus || "High Accuracy"
  );

  // Form Field States
  const [houseFlatBlock, setHouseFlatBlock] = useState(
    deliveryAddress?.houseFlatBlock || ""
  );
  const [apartmentRoadArea, setApartmentRoadArea] = useState(
    deliveryAddress?.apartmentRoadArea || ""
  );
  const [deliveryInstructions, setDeliveryInstructions] = useState(
    deliveryAddress?.deliveryInstructions || ""
  );
  const [landmark, setLandmark] = useState(
    deliveryAddress?.landmark || ""
  );
  const [addressType, setAddressType] = useState<AddressType>(
    deliveryAddress?.addressType || "Home"
  );
  const [formattedAddress, setFormattedAddress] = useState(
    deliveryAddress?.formattedAddress || ""
  );
  const [city, setCity] = useState(deliveryAddress?.city || "");
  const [zipCode, setZipCode] = useState(deliveryAddress?.zipCode || "");

  // Validation Error States
  const [errors, setErrors] = useState<{
    houseFlatBlock?: string;
    apartmentRoadArea?: string;
  }>({});

  const searchInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Callback to store map instance
  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    mapRef.current = mapInstance;
  }, []);

  const onMapUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  // Server-side / Client reverse geocode helper
  const reverseGeocode = useCallback(async (lat: number, lng: number, fallbackAccuracy?: "High Accuracy" | "Approximate" | "Manual") => {
    setIsGeocodingLoading(true);
    try {
      const response = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      const data = await response.json();

      if (data.status === "OK" && data.results && data.results.length > 0) {
        const topResult = data.results[0];
        const parsed = parseGoogleAddressComponents(
          topResult.address_components,
          topResult.formatted_address
        );

        setFormattedAddress(topResult.formatted_address);

        // Build composite apartment / road / area if not explicitly edited
        const areaRoad = [parsed.premise, parsed.streetNumber, parsed.streetName, parsed.area]
          .filter(Boolean)
          .join(", ");

        const resolvedArea = areaRoad || parsed.area || parsed.city || topResult.formatted_address;
        setApartmentRoadArea((prev) => (prev.trim() ? prev : resolvedArea));
        setSearchQuery(resolvedArea);

        if (parsed.city) setCity(parsed.city);
        if (parsed.zipCode) setZipCode(parsed.zipCode);
        if (parsed.landmark && !landmark) setLandmark(parsed.landmark);

        if (fallbackAccuracy) {
          setAccuracyStatus(fallbackAccuracy);
        }
      } else {
        // Fallback when API returns zero results
        const fallbackFormatted = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        setFormattedAddress((prev) => prev || fallbackFormatted);
        setApartmentRoadArea((prev) => prev || `Location (${fallbackFormatted})`);
      }
    } catch (err) {
      console.error("Reverse geocoding error:", err);
    } finally {
      setIsGeocodingLoading(false);
    }
  }, [landmark]);

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
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const newPos = { lat: latitude, lng: longitude };
        setPosition(newPos);
        setMapZoom(16);

        if (mapRef.current) {
          mapRef.current.panTo(newPos);
        }

        const calculatedAccuracy = accuracy && accuracy < 50 ? "High Accuracy" : "Approximate";
        setAccuracyStatus(calculatedAccuracy);

        // Trigger reverse geocoding
        reverseGeocode(latitude, longitude, calculatedAccuracy);
        setGpsLoading(false);
      },
      (error) => {
        setGpsLoading(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsError("Location permission denied. Please search or enter address manually.");
        } else if (error.code === error.TIMEOUT) {
          setGpsError("Location request timed out. Please try again or search manually.");
        } else {
          setGpsError("Unable to retrieve your location. Please search manually.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  // Initial geocoding or GPS resolution on first open
  useEffect(() => {
    if (!deliveryAddress) {
      // Auto-trigger GPS location if no address saved yet
      handleUseCurrentLocation();
    } else if (deliveryAddress.latitude && deliveryAddress.longitude) {
      setPosition({ lat: deliveryAddress.latitude, lng: deliveryAddress.longitude });
    }
  }, []);

  // Handle Google Places Autocomplete selection
  const onPlaceSelected = () => {
    if (!autocompleteRef.current) return;
    const place = autocompleteRef.current.getPlace();

    if (place && place.geometry && place.geometry.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const newPos = { lat, lng };

      setPosition(newPos);
      setMapZoom(16);

      if (mapRef.current) {
        mapRef.current.panTo(newPos);
      }

      const formatted = place.formatted_address || place.name || "";
      setFormattedAddress(formatted);

      const parsed = parseGoogleAddressComponents(
        place.address_components as google.maps.GeocoderAddressComponent[],
        formatted
      );

      const resolvedArea = place.name || [parsed.streetNumber, parsed.streetName, parsed.area].filter(Boolean).join(", ") || formatted;
      setApartmentRoadArea(resolvedArea);
      setSearchQuery(resolvedArea);

      if (parsed.city) setCity(parsed.city);
      if (parsed.zipCode) setZipCode(parsed.zipCode);
      if (parsed.landmark) setLandmark(parsed.landmark);

      setAccuracyStatus("High Accuracy");
      if (errors.apartmentRoadArea) {
        setErrors((prev) => ({ ...prev, apartmentRoadArea: undefined }));
      }
    }
  };

  // Handle map click
  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    const newPos = { lat, lng };

    setPosition(newPos);
    reverseGeocode(lat, lng, "Manual");
  };

  // Handle marker drag end
  const handleMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    const newPos = { lat, lng };

    setPosition(newPos);
    reverseGeocode(lat, lng, "Manual");
  };

  // Quick delivery chip toggle/append
  const handleToggleChip = (chipText: string) => {
    setDeliveryInstructions((prev) => {
      if (!prev.trim()) return chipText;
      if (prev.includes(chipText)) {
        return prev
          .replace(chipText, "")
          .replace(/,\s*,/g, ",")
          .replace(/^,\s*|,\s*$/g, "")
          .trim();
      }
      return `${prev.trim()}, ${chipText}`;
    });
  };

  // Adjust location button action
  const handleAdjustLocation = () => {
    searchInputRef.current?.focus();
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
      city: city || "Ahmedabad",
      zipCode: zipCode || undefined,
      formattedAddress:
        formattedAddress || `${apartmentRoadArea.trim()}, ${city || "Ahmedabad"}`,
      latitude: position.lat,
      longitude: position.lng,
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

  const currentAreaTag =
    formattedAddress.split(",").slice(0, 2).join(",").trim() ||
    apartmentRoadArea.split(",").slice(0, 2).join(",").trim() ||
    "Delivery Location";

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

        {/* Search Input Box with Google Places Autocomplete */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 z-10">
            <SearchIcon className="w-4 h-4 text-slate-400" />
          </div>

          {isLoaded && googleApiKey ? (
            <Autocomplete
              onLoad={(autocomplete) => {
                autocompleteRef.current = autocomplete;
              }}
              onPlaceChanged={onPlaceSelected}
            >
              <input
                ref={searchInputRef}
                id="location-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search area, street, building or landmark..."
                className="w-full bg-white text-slate-900 placeholder-slate-400 text-xs sm:text-sm rounded-lg pl-9 pr-8 py-2.5 shadow-sm border-0 focus:ring-2 focus:ring-indigo-400 font-medium truncate relative z-0"
              />
            </Autocomplete>
          ) : (
            <input
              ref={searchInputRef}
              id="location-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search area, street, building or landmark..."
              className="w-full bg-white text-slate-900 placeholder-slate-400 text-xs sm:text-sm rounded-lg pl-9 pr-8 py-2.5 shadow-sm border-0 focus:ring-2 focus:ring-indigo-400 font-medium truncate"
            />
          )}

          {searchQuery && (
            <button
              aria-label="Clear search input"
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
              type="button"
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer z-10"
            >
              <ClearCircleIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick GPS Fetch Action Button */}
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={gpsLoading}
          className="w-full mt-2.5 bg-[#3730a3]/90 hover:bg-[#3730a3] active:bg-[#312e81] border border-[#6366f1]/50 rounded-lg px-3 py-2 flex items-center justify-between transition-all cursor-pointer"
        >
          <div className="flex items-center space-x-2.5 text-left">
            <div className="w-6 h-6 rounded-full bg-[#4f46e5] flex items-center justify-center flex-shrink-0">
              <GpsCrosshairIcon
                className={`w-4 h-4 text-emerald-300 ${
                  gpsLoading ? "animate-spin" : ""
                }`}
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-white tracking-wide flex items-center gap-1.5">
                <span>
                  {gpsLoading ? "Locating you..." : "Use my current location"}
                </span>
              </div>
              <div className="text-[10px] text-[#e0e7ff]">
                Using GPS for doorstep accuracy
              </div>
            </div>
          </div>
          <svg
            className="w-4 h-4 text-[#e0e7ff]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M9 5l7 7-7 7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </button>

        {gpsError && (
          <div className="mt-2 text-[11px] text-rose-200 bg-rose-950/60 border border-rose-500/40 px-2.5 py-1.5 rounded-lg flex items-center justify-between">
            <span>{gpsError}</span>
            <button
              type="button"
              onClick={() => setGpsError(null)}
              className="text-white hover:underline text-[10px] ml-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </header>

      {/* ========================================================================= */}
      {/* 2. REAL GOOGLE MAPS / FALLBACK CANVAS SECTION                             */}
      {/* ========================================================================= */}
      <div
        className="relative w-full h-80 overflow-hidden select-none border-b border-slate-300 bg-slate-200"
        data-purpose="map-viewport"
      >
        {isLoaded && googleApiKey && !loadError ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={position}
            zoom={mapZoom}
            onLoad={onMapLoad}
            onUnmount={onMapUnmount}
            onClick={handleMapClick}
            mapTypeId={mapMode === "satellite" ? "satellite" : "roadmap"}
            options={{
              disableDefaultUI: true,
              zoomControl: false,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
              gestureHandling: "greedy",
            }}
          >
            {/* Draggable Marker */}
            <Marker
              position={position}
              draggable={true}
              onDragEnd={handleMarkerDragEnd}
            />
          </GoogleMap>
        ) : (
          /* Fallback Canvas Preview when Maps key is not set or loading */
          <div
            className={`w-full h-full flex flex-col items-center justify-center relative ${
              mapMode === "satellite" ? "map-satellite-bg" : "map-grid-bg"
            }`}
          >
            {/* Vector Map Graphics */}
            <svg
              className="w-full h-full object-cover absolute inset-0"
              fill="none"
              viewBox="0 0 400 320"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                fill={mapMode === "satellite" ? "#1e293b" : "#E8ECE9"}
                width="400"
                height="320"
              />
              <path
                d="M -10 240 L 420 175"
                stroke="#FDE047"
                strokeWidth="9"
                strokeLinecap="round"
              />
              <path
                d="M -10 240 L 420 175"
                stroke="#EAB308"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
              <path
                d="M 120 -10 L 195 330"
                stroke={mapMode === "satellite" ? "#475569" : "#FFFFFF"}
                strokeWidth="7"
              />
              <path
                d="M -20 100 L 420 70"
                stroke={mapMode === "satellite" ? "#475569" : "#FFFFFF"}
                strokeWidth="6"
              />
              <path
                d="M 60 270 L 380 90"
                stroke={mapMode === "satellite" ? "#475569" : "#FFFFFF"}
                strokeWidth="5"
              />
            </svg>

            {/* Pulsing Floor Target Marker */}
            <div className="relative flex flex-col items-center justify-center z-10">
              <div className="w-8 h-8 rounded-full bg-[#4f46e5]/30 pin-pulse absolute"></div>
              <DeliveryTargetPinIcon className="w-9 h-9 text-[#4338ca] drop-shadow-lg z-10 -mt-1" />
            </div>

            {!googleApiKey && (
              <div className="absolute top-12 bg-white/90 backdrop-blur-xs text-slate-700 text-[10px] font-semibold px-2.5 py-1 rounded-md shadow-xs border border-slate-200 z-10">
                Maps preview mode (Set NEXT_PUBLIC_GOOGLE_MAP_API_KEY for live satellite/roads)
              </div>
            )}
          </div>
        )}

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
            <GpsCrosshairIcon
              className={`w-4 h-4 text-[#4338ca] ${
                gpsLoading ? "animate-spin" : ""
              }`}
            />
            <span>Find Me</span>
          </button>
        </div>

        {/* Dynamic Delivery Pin Callout Bubble overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center -translate-y-8 z-20">
          <div className="bg-slate-900/90 text-white px-3 py-1.5 rounded-lg shadow-xl text-center flex flex-col items-center animate-bounce duration-700 mb-1 border border-slate-700 backdrop-blur-sm">
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-[11px] font-bold text-white tracking-wide">
                Order delivered here
              </span>
            </div>
            <span className="text-[10px] text-slate-300 font-medium truncate max-w-[200px]">
              {apartmentRoadArea || formattedAddress || "Drag pin to exact doorstep"}
            </span>
            <div className="w-2 h-2 bg-slate-900/90 rotate-45 -mb-2.5 mt-0.5"></div>
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
                {isGeocodingLoading && (
                  <span className="text-[10px] text-indigo-500 animate-pulse">
                    Resolving address...
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-800 mt-0.5 break-words">
                {formattedAddress || (apartmentRoadArea ? `${apartmentRoadArea}, ${city || "Ahmedabad"}` : "Select a location on map or search above")}
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
                errors.houseFlatBlock
                  ? "border-rose-500 ring-1 ring-rose-500"
                  : "border-slate-300"
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
                errors.apartmentRoadArea
                  ? "border-rose-500 ring-1 ring-rose-500"
                  : "border-slate-300"
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
              <label
                htmlFor="delivery-notes"
                className="block font-semibold text-slate-700"
              >
                Delivery instructions{" "}
                <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <span className="text-[10px] text-[#4f46e5] font-medium">
                For rider safety
              </span>
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
            <label
              htmlFor="extra-details"
              className="block font-semibold text-slate-700 mb-1"
            >
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
                <HomeAddressIcon
                  className={`w-4 h-4 ${
                    addressType === "Home" ? "text-white" : "text-slate-500"
                  }`}
                />
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
                <OfficeAddressIcon
                  className={`w-4 h-4 ${
                    addressType === "Office" ? "text-white" : "text-slate-500"
                  }`}
                />
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
                <OtherAddressIcon
                  className={`w-4 h-4 ${
                    addressType === "Other" ? "text-white" : "text-slate-500"
                  }`}
                />
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
