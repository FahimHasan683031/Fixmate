import axios from "axios";

export interface IShippingAddress {
  name: string; // ✅ required (TS-safe)
  street1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  countryCode: string;
}


const TYPE_MAP: Record<string, string> = {
  hotel: "lodging",
  airport: "airport",
  carRental: "car_rental",
  ship: "establishment",
  airbnb: "lodging",
  hospital: "hospital",
  travelAgency: "travel_agency",
  event: "establishment",
  museum: "museum",
  intercityBus: "bus_station",
  stadium: "stadium",
  trainStation: "train_station",
};

/**
 * Keywords for Autocomplete API (since it doesn't support all types)
 */
const KEYWORD_MAP: Record<string, string> = {
  hotel: "hotel",
  airport: "airport",
  carRental: "car rental",
  ship: "ship port",
  airbnb: "airbnb",
  hospital: "hospital",
  travelAgency: "travel agency",
  event: "event venue",
  museum: "museum",
  intercityBus: "bus station",
  stadium: "stadium",
  trainStation: "train station",
};

/**
 * Google Autocomplete Response Types
 */
interface GoogleAutocompletePrediction {
  description: string;
  place_id: string;
}

interface GoogleAutocompleteResponse {
  predictions: GoogleAutocompletePrediction[];
  status: string;
}

interface GooglePlaceAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GooglePlaceDetailsResult {
  name?: string;
  formatted_address?: string;
  address_components?: GooglePlaceAddressComponent[];
}

interface GooglePlaceDetailsResponse {
  result: GooglePlaceDetailsResult;
  status: string;
}

interface GoogleTextSearchPlace {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  address_components?: GooglePlaceAddressComponent[];
}

interface GoogleTextSearchResponse {
  results: GoogleTextSearchPlace[];
  status: string;
}



export const searchLocationsByQuery = async (
  search: string,
  type?: string
): Promise<IShippingAddress[]> => {
  const isTypedSearch = Boolean(type);

  console.log({ search, type })

  const googleType = isTypedSearch
    ? TYPE_MAP[type!.toLowerCase()] || "establishment"
    : "establishment";

  // 🔥 CASE 1: EMPTY SEARCH → TEXT SEARCH (only if type is provided)
  if (!search || search.trim().length === 0) {
    // If no type is provided, return empty array (no meaningful search)
    if (!isTypedSearch) {
      return [];
    }

    const textSearchRes = await axios.get<GoogleTextSearchResponse>(
      "https://maps.googleapis.com/maps/api/place/textsearch/json",
      {
        params: {
          query: googleType, // hotel / airport / hospital
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      }
    );

    const places = textSearchRes.data.results || [];

    // 🔹 Fetch complete address details for each place
    const results: Array<IShippingAddress | null> = await Promise.all(
      places.slice(0, 10).map(async (place) => {
        try {
          const placeId = place.place_id;

          if (!placeId) {
            // Fallback: return basic info without details
            return {
              name: place.name ?? "",
              street1: place.formatted_address ?? "",
              city: "",
              state: "",
              postal_code: "",
              country: "",
              countryCode: "",
            };
          }

          const detailsRes = await axios.get<GooglePlaceDetailsResponse>(
            "https://maps.googleapis.com/maps/api/place/details/json",
            {
              params: {
                place_id: placeId,
                key: process.env.GOOGLE_MAPS_API_KEY,
                fields: "name,formatted_address,address_component",
              },
            }
          );

          const result = detailsRes.data.result;
          const components = result.address_components ?? [];

          const getComponent = (type: string) =>
            components.find((c) => c.types.includes(type));

          return {
            name: result.name ?? place.name ?? "",
            street1: result.formatted_address ?? place.formatted_address ?? "",
            city:
              getComponent("locality")?.long_name ||
              getComponent("sublocality")?.long_name ||
              "",
            state:
              getComponent("administrative_area_level_1")?.long_name || "",
            postal_code: getComponent("postal_code")?.long_name || "",
            country: getComponent("country")?.long_name || "",
            countryCode: getComponent("country")?.short_name || "",
          };
        } catch {
          // If details fetch fails, return basic info
          return {
            name: place.name ?? "",
            street1: place.formatted_address ?? "",
            city: "",
            state: "",
            postal_code: "",
            country: "",
            countryCode: "",
          };
        }
      })
    );

    return results.filter(
      (item): item is IShippingAddress => item !== null
    );
  }

  // 🔹 CASE 2: NORMAL SEARCH → AUTOCOMPLETE
  const autoCompleteParams: any = {
    input: search,
    key: process.env.GOOGLE_MAPS_API_KEY,
  };

  // If type is provided, use keyword instead of types for better results
  if (isTypedSearch) {
    const keyword = KEYWORD_MAP[type!.toLowerCase()];
    if (keyword) {
      // Combine search query with keyword for better filtering
      autoCompleteParams.input = `${keyword} ${search}`.trim();
    }
    // Use establishment type which is widely supported
    autoCompleteParams.types = "establishment";
  } else {
    // For address search without type
    autoCompleteParams.types = "address";
  }

  const autoCompleteRes = await axios.get<GoogleAutocompleteResponse>(
    "https://maps.googleapis.com/maps/api/place/autocomplete/json",
    { params: autoCompleteParams }
  );

  console.log("Autocomplete response:", {
    status: autoCompleteRes.data.status,
    count: autoCompleteRes.data.predictions?.length || 0,
    searchInput: autoCompleteParams.input,
    types: autoCompleteParams.types,
  });

  const predictions = autoCompleteRes.data.predictions;
  if (!predictions || predictions.length === 0) return [];

  const results: Array<IShippingAddress | null> = await Promise.all(
    predictions.slice(0, 10).map(async (prediction) => {
      try {
        const detailsRes = await axios.get<GooglePlaceDetailsResponse>(
          "https://maps.googleapis.com/maps/api/place/details/json",
          {
            params: {
              place_id: prediction.place_id,
              key: process.env.GOOGLE_MAPS_API_KEY,
              fields: "name,formatted_address,address_component",
            },
          }
        );

        const result = detailsRes.data.result;
        const components = result.address_components ?? [];

        const getComponent = (type: string) =>
          components.find((c) => c.types.includes(type));

        return {
          name: result.name ?? prediction.description,
          street1: result.formatted_address ?? "",
          city:
            getComponent("locality")?.long_name ||
            getComponent("sublocality")?.long_name ||
            "",
          state:
            getComponent("administrative_area_level_1")?.long_name || "",
          postal_code: getComponent("postal_code")?.long_name || "",
          country: getComponent("country")?.long_name || "",
          countryCode: getComponent("country")?.short_name || "",
        };
      } catch {
        return null;
      }
    })
  );

  return results.filter(
    (item): item is IShippingAddress => item !== null
  );
};
