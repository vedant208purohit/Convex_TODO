import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const input = searchParams.get("input");

    if (!input || !input.trim()) {
      return NextResponse.json({ predictions: [] });
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

    // Call Google Places Autocomplete API
    // types=establishment or restaurant
    const url = new URL(
      "https://maps.googleapis.com/maps/api/place/autocomplete/json"
    );
    url.searchParams.set("input", input.trim());
    url.searchParams.set("types", "establishment");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === "OK" || data.status === "ZERO_RESULTS") {
      const predictions = (data.predictions || []).map((item: any) => ({
        placeId: item.place_id,
        name: item.structured_formatting?.main_text || item.description,
        address: item.description,
        secondaryText: item.structured_formatting?.secondary_text || "",
      }));
      return NextResponse.json({ predictions });
    } else {
      console.error("Google Places Autocomplete error:", data);
      return NextResponse.json(
        { error: data.error_message || data.status, predictions: [] },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Error in places autocomplete route:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch suggestions" },
      { status: 500 }
    );
  }
}

