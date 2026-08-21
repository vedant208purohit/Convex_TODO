const customDomain = process.env.CLERK_JWT_ISSUER_DOMAIN?.trim();

const providers = [
  {
    domain: "https://neat-oyster-3072.clerk.accounts.dev",
    applicationID: "convex",
  },
  {
    domain: "https://clerk.get-prest.com",
    applicationID: "convex",
  },
];

if (customDomain && !providers.some((p) => p.domain === customDomain)) {
  providers.push({
    domain: customDomain,
    applicationID: "convex",
  });
}

const authConfig = {
  providers,
};

export default authConfig;