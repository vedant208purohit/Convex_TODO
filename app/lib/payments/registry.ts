import { PaymentProviderAdapter } from "./types";
import { RazorpayProviderAdapter } from "./adapters/RazorpayProviderAdapter";
import { StripeProviderAdapter } from "./adapters/StripeProviderAdapter";

/**
 * Centralized Provider Adapter Registry
 *
 * Keeps provider-specific logic completely isolated in adapters
 * while maintaining a generic interface for all API routes and services.
 */
class PaymentProviderRegistry {
  private adapters = new Map<string, PaymentProviderAdapter>();

  constructor() {
    // Register initial providers
    this.registerAdapter(new RazorpayProviderAdapter());
    this.registerAdapter(new StripeProviderAdapter());
  }

  registerAdapter(adapter: PaymentProviderAdapter): void {
    this.adapters.set(adapter.provider.toLowerCase(), adapter);
  }

  getAdapter(provider: string): PaymentProviderAdapter {
    const normalized = (provider || "").toLowerCase().trim();
    const adapter = this.adapters.get(normalized);
    if (!adapter) {
      throw new Error(
        `Unsupported payment provider: "${provider}". Supported providers: ${Array.from(this.adapters.keys()).join(", ")}`
      );
    }
    return adapter;
  }

  isSupported(provider: string): boolean {
    return this.adapters.has((provider || "").toLowerCase().trim());
  }
}

export const providerRegistry = new PaymentProviderRegistry();

export function getPaymentAdapter(provider: string): PaymentProviderAdapter {
  return providerRegistry.getAdapter(provider);
}

