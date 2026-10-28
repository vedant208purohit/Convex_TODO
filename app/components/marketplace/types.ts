export type MarketplaceCategory =
  | "all"
  | "Payments"
  | "Communication"
  | "Delivery & Shipping"
  | "Analytics"
  | "Operations"
  | "Marketing"
  | "Loyalty & Rewards";

export type MarketplaceTab =
  | "explore"
  | "installed"
  | "categories"
  | "purchases"
  | "wallet";

export type MarketplaceSortOption =
  | "recommended"
  | "a-z"
  | "recently-added"
  | "price-low-high";

export type AppBadge =
  | "Featured"
  | "Installed"
  | "Live"
  | "Attention"
  | "Available"
  | "Popular"
  | "Partner";

export type AppStatusType =
  | "available"
  | "installed"
  | "live"
  | "attention"
  | "paid_required";

export interface PracticalFeature {
  icon: string;
  title: string;
  description: string;
}

export interface SetupPrerequisite {
  icon: string;
  title: string;
  detail: string;
}

export interface MarketplaceApp {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  vendor: string;
  category: MarketplaceCategory;
  description: string;
  badge?: AppBadge;
  iconName: string;
  rating?: string;
  version?: string;
  statusText: string;
  statusType: AppStatusType;
  priceText: string;
  priceAmount: number;
  isOneTime?: boolean;
  actionText: string;
  actionType: "purchase" | "setup" | "settings" | "fix" | "install" | "details" | "open";
  isInstalled?: boolean;
  practicalFeatures?: PracticalFeature[];
  prerequisites?: SetupPrerequisite[];
  permissions?: string[];
  terms?: {
    licenseType: string;
    platformSurcharge: string;
    taxes: string;
  };
}

export interface WalletState {
  balance: number;
  initialBalance: number;
}
