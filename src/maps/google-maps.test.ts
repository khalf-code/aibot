import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getDirections,
  reverseGeocode,
  searchNearbyPlaces,
} from "./google-maps.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("getDirections", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns directions with duration and distance", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            routes: [
              {
                duration: "1500s",
                distanceMeters: 5000,
                localizedValues: {
                  duration: { text: "25 min" },
                  distance: { text: "5.0 km" },
                },
              },
            ],
          }),
        ),
    });

    const result = await getDirections({
      apiKey: "test-key",
      origin: "Munich HBF",
      destination: "Marienplatz",
      mode: "transit",
    });

    expect(result.durationText).toBe("25 min");
    expect(result.durationSeconds).toBe(1500);
    expect(result.distanceMeters).toBe(5000);
    expect(result.distanceText).toBe("5.0 km");
    expect(result.mode).toBe("transit");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
    );
    expect(options.headers["x-goog-api-key"]).toBe("test-key");
  });

  it("handles lat,lng coordinates as origin/destination", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            routes: [
              {
                duration: "600s",
                distanceMeters: 2000,
                localizedValues: {
                  duration: { text: "10 min" },
                  distance: { text: "2.0 km" },
                },
              },
            ],
          }),
        ),
    });

    const result = await getDirections({
      apiKey: "test-key",
      origin: { latitude: 48.137, longitude: 11.576 },
      destination: { latitude: 48.135, longitude: 11.58 },
      mode: "walking",
    });

    expect(result.origin).toBe("48.137,11.576");
    expect(result.destination).toBe("48.135,11.58");
    expect(result.mode).toBe("walking");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.origin.location.latLng.latitude).toBe(48.137);
    expect(body.travelMode).toBe("WALK");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve("Bad Request: invalid origin"),
    });

    await expect(
      getDirections({
        apiKey: "test-key",
        origin: "",
        destination: "Marienplatz",
      }),
    ).rejects.toThrow("Google Maps Routes API error (HTTP 400)");
  });

  it("throws when no routes found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ routes: [] })),
    });

    await expect(
      getDirections({
        apiKey: "test-key",
        origin: "Nonexistent Place 12345",
        destination: "Another Nonexistent",
      }),
    ).rejects.toThrow("No routes found");
  });

  it("maps travel modes correctly", async () => {
    const modes = [
      { input: "driving", expected: "DRIVE" },
      { input: "walking", expected: "WALK" },
      { input: "bicycling", expected: "BICYCLE" },
      { input: "transit", expected: "TRANSIT" },
    ] as const;

    for (const { input, expected } of modes) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              routes: [{ duration: "300s", distanceMeters: 1000 }],
            }),
          ),
      });

      await getDirections({
        apiKey: "test-key",
        origin: "A",
        destination: "B",
        mode: input,
      });

      const lastCall = mockFetch.mock.calls.at(-1);
      const body = JSON.parse(lastCall?.[1]?.body ?? "{}");
      expect(body.travelMode).toBe(expected);
    }
  });
});

describe("searchNearbyPlaces", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns places with structured data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            places: [
              {
                displayName: { text: "Hofbräuhaus München" },
                formattedAddress: "Platzl 9, 80331 München",
                location: { latitude: 48.137, longitude: 11.579 },
                rating: 4.5,
                types: ["restaurant", "bar"],
                currentOpeningHours: { openNow: true },
                priceLevel: "PRICE_LEVEL_MODERATE",
                id: "ChIJ123",
              },
            ],
          }),
        ),
    });

    const result = await searchNearbyPlaces({
      apiKey: "test-key",
      location: { latitude: 48.137, longitude: 11.576 },
      type: "restaurant",
      radius: 500,
    });

    expect(result.places).toHaveLength(1);
    expect(result.places[0].name).toBe("Hofbräuhaus München");
    expect(result.places[0].rating).toBe(4.5);
    expect(result.places[0].openNow).toBe(true);
    expect(result.places[0].priceLevel).toBe(2);
  });

  it("handles empty results", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({})),
    });

    const result = await searchNearbyPlaces({
      apiKey: "test-key",
      location: { latitude: 0, longitude: 0 },
    });

    expect(result.places).toEqual([]);
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve("API key invalid"),
    });

    await expect(
      searchNearbyPlaces({
        apiKey: "invalid-key",
        location: { latitude: 48.137, longitude: 11.576 },
      }),
    ).rejects.toThrow("Google Maps Places API error (HTTP 403)");
  });
});

describe("reverseGeocode", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns structured address components", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            status: "OK",
            results: [
              {
                formatted_address: "Marienplatz, 80331 München, Germany",
                place_id: "ChIJ456",
                address_components: [
                  { types: ["route"], long_name: "Marienplatz" },
                  { types: ["locality"], long_name: "München" },
                  {
                    types: ["administrative_area_level_1"],
                    long_name: "Bavaria",
                  },
                  { types: ["country"], long_name: "Germany" },
                  { types: ["postal_code"], long_name: "80331" },
                ],
              },
            ],
          }),
        ),
    });

    const result = await reverseGeocode({
      apiKey: "test-key",
      location: { latitude: 48.137, longitude: 11.576 },
    });

    expect(result.formattedAddress).toBe("Marienplatz, 80331 München, Germany");
    expect(result.street).toBe("Marienplatz");
    expect(result.city).toBe("München");
    expect(result.state).toBe("Bavaria");
    expect(result.country).toBe("Germany");
    expect(result.postalCode).toBe("80331");
  });

  it("throws on ZERO_RESULTS", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            status: "ZERO_RESULTS",
            results: [],
          }),
        ),
    });

    await expect(
      reverseGeocode({
        apiKey: "test-key",
        location: { latitude: 0, longitude: 0 },
      }),
    ).rejects.toThrow("Geocoding API error: ZERO_RESULTS");
  });

  it("throws on REQUEST_DENIED with error message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            status: "REQUEST_DENIED",
            error_message: "API key is invalid",
          }),
        ),
    });

    await expect(
      reverseGeocode({
        apiKey: "invalid-key",
        location: { latitude: 48.137, longitude: 11.576 },
      }),
    ).rejects.toThrow(
      "Geocoding API error: REQUEST_DENIED: API key is invalid",
    );
  });
});
