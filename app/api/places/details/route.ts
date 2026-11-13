import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const placeId = searchParams.get("placeId");

    if (!placeId) {
      return NextResponse.json(
        { error: "placeId is required" },
        { status: 400 }
      );
    }

    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Maps API Key not configured" },
        { status: 500 }
      );
    }

    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
      placeId
    )}&key=${apiKey}`;
    const response = await fetch(detailsUrl);
    const data = await response.json();

    if (data.status !== "OK" || !data.result) {
      console.error("Google Place Details API error:", data);
      return NextResponse.json(
        { error: data.error_message || data.status },
        { status: 400 }
      );
    }

    const result = data.result;

    // Parse Address Components
    let streetNumber = "";
    let route = "";
    let city = "";
    let state = "";
    let stateCode = "";
    let country = "";
    let countryCode = "";
    let postalCode = "";

    const components = result.address_components || [];
    for (const comp of components) {
      const types = comp.types || [];
      if (types.includes("street_number")) {
        streetNumber = comp.long_name;
      }
      if (types.includes("route")) {
        route = comp.long_name;
      }
      if (
        types.includes("locality") ||
        types.includes("postal_town") ||
        types.includes("sublocality_level_1")
      ) {
        if (!city) city = comp.long_name;
      }
      if (types.includes("administrative_area_level_1")) {
        state = comp.long_name;
        stateCode = comp.short_name;
      }
      if (types.includes("country")) {
        country = comp.long_name;
        countryCode = comp.short_name;
      }
      if (types.includes("postal_code")) {
        postalCode = comp.long_name;
      }
    }

    const streetAddress =
      [streetNumber, route].filter(Boolean).join(" ") ||
      result.formatted_address ||
      result.vicinity ||
      "";

    // Determine Timezone if coordinates available
    let timezone = "";
    const lat = result.geometry?.location?.lat;
    const lng = result.geometry?.location?.lng;

    if (lat !== undefined && lng !== undefined) {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const tzRes = await fetch(
          `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${timestamp}&key=${apiKey}`
        );
        const tzData = await tzRes.json();
        if (tzData.status === "OK" && tzData.timeZoneId) {
          timezone = tzData.timeZoneId;
        }
      } catch (tzErr) {
        console.warn("Timezone API lookup failed:", tzErr);
      }
    }

    // Default currency based on country code
    let currency = "USD";
    if (countryCode === "IN") currency = "INR";
    else if (countryCode === "GB") currency = "GBP";
    else if (
      countryCode === "EU" ||
      ["FR", "DE", "IT", "ES", "NL"].includes(countryCode)
    )
      currency = "EUR";
    else if (countryCode === "CA") currency = "CAD";
    else if (countryCode === "AU") currency = "AUD";

    // Country-based timezone fallback if Google Timezone API is disabled/empty
    if (!timezone) {
      if (countryCode === "IN") timezone = "Asia/Kolkata";
      else if (countryCode === "GB") timezone = "Europe/London";
      else if (countryCode === "AE") timezone = "Asia/Dubai";
      else if (countryCode === "FR" || countryCode === "DE" || countryCode === "IT" || countryCode === "ES") timezone = "Europe/Paris";
      else if (countryCode === "AU") timezone = "Australia/Sydney";
      else if (countryCode === "CA" || countryCode === "US") timezone = "America/New_York";
    }

    return NextResponse.json({
      placeId,
      name: result.name || "",
      formattedAddress: result.formatted_address || result.vicinity || "",
      streetAddress,
      city,
      state: stateCode || state,
      stateFullName: state,
      country: countryCode || country,
      countryFullName: country,
      postalCode,
      phoneNumber:
        result.international_phone_number ||
        result.formatted_phone_number ||
        "",
      latitude: lat,
      longitude: lng,
      timezone,
      currency,
      website: result.website || "",
      types: result.types || [],
      dineIn: result.dine_in ?? true,
      takeout: result.takeout ?? true,
      delivery: result.delivery ?? false,
      servesBeer: result.serves_beer ?? false,
      servesWine: result.serves_wine ?? false,
      servesVegetarianFood: result.serves_vegetarian_food ?? false,
    });
  } catch (error: any) {
    console.error("Error in place details route:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch place details" },
      { status: 500 }
    );
  }
}
