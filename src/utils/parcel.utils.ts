
export interface ParcelInput {
  name: string;
  length: number;
  width: number;
  height: number;
  distance_unit: "in";
  weight: number;
  mass_unit: "kg";
}

const PARCEL_PRESETS: Record<string, Omit<ParcelInput, "name">> = {
  // ------- DOCUMENTS -------
  "Passport": { length: 12, width: 9, height: 1, distance_unit: "in", weight: 0.23, mass_unit: "kg" },
  "ID Card": { length: 6, width: 4, height: 1, distance_unit: "in", weight: 0.09, mass_unit: "kg" },
  "Drivers Licence": { length: 6, width: 4, height: 1, distance_unit: "in", weight: 0.09, mass_unit: "kg" },
  "Professional Card": { length: 6, width: 4, height: 1, distance_unit: "in", weight: 0.09, mass_unit: "kg" },
  "Credit Cards": { length: 6, width: 4, height: 1, distance_unit: "in", weight: 0.09, mass_unit: "kg" },
  "Purse": { length: 10, width: 6, height: 3, distance_unit: "in", weight: 0.45, mass_unit: "kg" },

  // ------- ELECTRONICS -------
  "Laptop": { length: 15, width: 11, height: 3, distance_unit: "in", weight: 1.81, mass_unit: "kg" },
  "Smartphone": { length: 7, width: 4, height: 2, distance_unit: "in", weight: 0.45, mass_unit: "kg" },
  "Tablet": { length: 10, width: 7, height: 2, distance_unit: "in", weight: 0.68, mass_unit: "kg" },
  "e-reader": { length: 8, width: 5, height: 2, distance_unit: "in", weight: 0.45, mass_unit: "kg" },
  "Headphones & Airpods": { length: 8, width: 6, height: 4, distance_unit: "in", weight: 0.45, mass_unit: "kg" },
  "Smartwatch": { length: 6, width: 6, height: 3, distance_unit: "in", weight: 0.23, mass_unit: "kg" },
  "Camera": { length: 10, width: 7, height: 6, distance_unit: "in", weight: 0.91, mass_unit: "kg" },
  "Game Console": { length: 15, width: 10, height: 5, distance_unit: "in", weight: 2.72, mass_unit: "kg" },
  "Charger": { length: 5, width: 5, height: 3, distance_unit: "in", weight: 0.14, mass_unit: "kg" },

  // ------- CLOTHES -------
  "Trousers": { length: 12, width: 10, height: 2, distance_unit: "in", weight: 0.45, mass_unit: "kg" },
  "Shorts": { length: 10, width: 8, height: 2, distance_unit: "in", weight: 0.36, mass_unit: "kg" },
  "Blouse": { length: 12, width: 10, height: 2, distance_unit: "in", weight: 0.36, mass_unit: "kg" },
  "Shirt": { length: 12, width: 10, height: 2, distance_unit: "in", weight: 0.36, mass_unit: "kg" },
  "Skirt": { length: 12, width: 10, height: 2, distance_unit: "in", weight: 0.32, mass_unit: "kg" },
  "Jacket": { length: 16, width: 14, height: 5, distance_unit: "in", weight: 0.91, mass_unit: "kg" },
  "Swimsuit": { length: 10, width: 8, height: 2, distance_unit: "in", weight: 0.23, mass_unit: "kg" },
  "Sweatshirt - Hoodie": { length: 14, width: 12, height: 4, distance_unit: "in", weight: 0.68, mass_unit: "kg" },
  "Shoes": { length: 14, width: 10, height: 6, distance_unit: "in", weight: 1.36, mass_unit: "kg" },
  "Belt": { length: 10, width: 4, height: 2, distance_unit: "in", weight: 0.18, mass_unit: "kg" },
  "Hat": { length: 12, width: 10, height: 6, distance_unit: "in", weight: 0.23, mass_unit: "kg" },

  // ------- ACCESSORIES -------
  "Keys": { length: 6, width: 4, height: 1, distance_unit: "in", weight: 0.14, mass_unit: "kg" },
  "Glasses": { length: 7, width: 3, height: 3, distance_unit: "in", weight: 0.23, mass_unit: "kg" },
  "Perfume": { length: 6, width: 4, height: 3, distance_unit: "in", weight: 0.32, mass_unit: "kg" },

  // ------- JEWELLERY -------
  "Watch": { length: 6, width: 6, height: 2, distance_unit: "in", weight: 0.18, mass_unit: "kg" },
  "Ring": { length: 4, width: 4, height: 2, distance_unit: "in", weight: 0.09, mass_unit: "kg" },
  "Earring": { length: 4, width: 4, height: 2, distance_unit: "in", weight: 0.09, mass_unit: "kg" },
  "Bracelet": { length: 5, width: 5, height: 2, distance_unit: "in", weight: 0.14, mass_unit: "kg" },
  "Necklace": { length: 6, width: 6, height: 2, distance_unit: "in", weight: 0.14, mass_unit: "kg" },

  // ------- BAGS -------
  "Backpack": { length: 18, width: 14, height: 6, distance_unit: "in", weight: 0.91, mass_unit: "kg" },
  "Small cabin bag": { length: 22, width: 14, height: 8, distance_unit: "in", weight: 2.72, mass_unit: "kg" },
  "Large suitcase": { length: 28, width: 20, height: 10, distance_unit: "in", weight: 6.80, mass_unit: "kg" },
  "Purse, Pencil case": { length: 10, width: 6, height: 3, distance_unit: "in", weight: 0.45, mass_unit: "kg" },
  "Handbag": { length: 14, width: 10, height: 5, distance_unit: "in", weight: 0.54, mass_unit: "kg" },
  "Shopping bag": { length: 12, width: 8, height: 4, distance_unit: "in", weight: 0.36, mass_unit: "kg" },
  "Fanny pack": { length: 8, width: 5, height: 3, distance_unit: "in", weight: 0.32, mass_unit: "kg" },

  // ------- SPORTS ITEMS -------
  "Surf": { length: 70, width: 20, height: 6, distance_unit: "in", weight: 5.44, mass_unit: "kg" },
  "Kite": { length: 30, width: 8, height: 6, distance_unit: "in", weight: 2.72, mass_unit: "kg" },
  "Ski": { length: 72, width: 6, height: 6, distance_unit: "in", weight: 4.54, mass_unit: "kg" },
  "Golf bag": { length: 48, width: 12, height: 12, distance_unit: "in", weight: 9.07, mass_unit: "kg" },
  "Tennis": { length: 28, width: 12, height: 6, distance_unit: "in", weight: 2.27, mass_unit: "kg" },
  "Bicycle": { length: 54, width: 8, height: 30, distance_unit: "in", weight: 15.88, mass_unit: "kg" },
  "Other Sport Gear": { length: 20, width: 12, height: 8, distance_unit: "in", weight: 4.54, mass_unit: "kg" },

  // ------- OTHER -------
  "Other": { length: 10, width: 10, height: 5, distance_unit: "in", weight: 0.91, mass_unit: "kg" },
};

export const generateParcel = (parcelData: { itemType: string; name: string; description?: string }): ParcelInput & { itemType: string; description?: string } => {
  const { itemType, name, description } = parcelData;
  const preset = PARCEL_PRESETS[itemType] || PARCEL_PRESETS["Other"];

  return {
    itemType,
    name,
    description: description || "",
    ...preset,
  };
};
