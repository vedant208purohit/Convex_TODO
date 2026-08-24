const issuerDomain = process.env.CLERK_JWT_ISSUER_DOMAIN?.trim();

if (!issuerDomain) {
  throw new Error("CLERK_JWT_ISSUER_DOMAIN must be set for the Master Convex deployment.");
}

const authConfig = {
  providers: [{
    domain: issuerDomain,
    applicationID: "convex",
  }],
};

export default authConfig;
