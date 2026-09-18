export interface CustomerOrganization {
  _id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  isVeg?: boolean;
  isDineIn?: boolean;
  isTakeAway?: boolean;
  isDelivery?: boolean;
  defaultCurrencySymbol?: string;
  defaultCurrency?: string;
}

export interface CustomerTable {
  _id: string;
  tableNumber: string;
  placement?: string;
  seatingCapacity: number;
  layoutName?: string | null;
  isBlock?: boolean;
  isRequested?: boolean;
}

export interface CustomerQr {
  _id: string;
  name: string;
  qrType: "DineIn" | "TakeAway" | "Queue";
}

export interface CustomerSessionResult {
  valid: boolean;
  error?: string;
  errorCode?: "ORG_NOT_FOUND" | "TABLE_NOT_FOUND" | "TABLE_BLOCKED" | "TABLE_INACTIVE";
  table?: CustomerTable;
  qr?: CustomerQr | null;
  organization?: CustomerOrganization;
}

export interface CustomizationItemOption {
  id: string;
  name: string;
  price: number; // minor units (paise)
  display_price: string;
  is_gst?: boolean;
  is_veg?: boolean;
  is_available: boolean;
  position: number;
  description?: string;
}

export interface CustomizationGroup {
  id: string;
  name: string;
  customization_type: string; // "Add-Ons" | "Preparations"
  required: boolean;
  max_selected: number;
  position: number;
  published: boolean;
  customization_items: CustomizationItemOption[];
}

export interface CustomerMenuItem {
  id: string;
  name: string;
  price: number; // minor units (paise)
  display_price: string;
  description?: string;
  published: boolean;
  is_available: boolean;
  is_gst?: boolean;
  is_veg?: boolean;
  is_spicy?: boolean;
  show_quantity?: boolean;
  quantity?: number;
  quantity_unit?: string;
  mark_as_bestseller?: boolean;
  favourite_item?: boolean;
  serving_size?: string;
  serving?: number;
  badge?: string; // "Bestseller" | "Chef Recommended" | "Barista Choice"
  original_price?: number; // for discount strikethrough (in minor units)
  display_original_price?: string;
  customizations?: CustomizationGroup[];
  item_image_url?: string;
}

export interface CustomerCategoryItem {
  category_item_id: string;
  item: CustomerMenuItem;
  customizations: CustomizationGroup[];
  item_image_url?: string;
}

export interface CustomerCategory {
  category: {
    id: string;
    name: string;
    position: number;
    published: boolean;
    items: CustomerCategoryItem[];
  };
}

export interface SelectedCustomization {
  customizationId: string;
  customizationName: string;
  optionId: string;
  optionName: string;
  price: number;
}

export interface CartItem {
  cartItemId: string; // composite key
  itemId: string;
  name: string;
  price: number; // base price (paise)
  totalUnitPrice: number; // base + customizations (paise)
  quantity: number;
  imageUrl?: string;
  isVeg?: boolean;
  customizations?: SelectedCustomization[];
}
