import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");

    if (!lat || !lng) {
      return NextResponse.json(
        { status: "INVALID_REQUEST", error_message: "Missing lat or lng query parameters", results: [] },
        { status: 400 }
      );
    }

    const apiKey =
      process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAP_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          status: "API_KEY_MISSING",
          error_message: "Google Maps API key is not configured on server.",
          results: [],
        },
        { status: 200 }
      );
    }

    const googleGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(
      lat
    )},${encodeURIComponent(lng)}&key=${apiKey}`;

    const response = await fetch(googleGeocodeUrl, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          status: "UPSTREAM_ERROR",
          error_message: `Google Geocoding API returned status ${response.status}`,
          results: [],
        },
        { status: 200 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Geocoding API Route Error:", error);
    return NextResponse.json(
      {
        status: "INTERNAL_ERROR",
        error_message: error?.message || "Failed to process geocode request",
        results: [],
      },
      { status: 500 }
    );
  }
}
