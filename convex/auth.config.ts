const envIssuer = process.env.CLERK_JWT_ISSUER_DOMAIN?.trim();

const domains = new Set<string>();
if (envIssuer) {
  domains.add(envIssuer);
}
domains.add("https://modest-raptor-18.clerk.accounts.dev");
domains.add("https://neat-oyster-3072.clerk.accounts.dev");

const authConfig = {
  providers: Array.from(domains).map((domain) => ({
    domain,
    applicationID: "convex",
  })),
};

export default authConfig;

