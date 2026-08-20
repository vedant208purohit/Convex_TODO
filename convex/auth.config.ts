export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN || "https://neat-oyster-3072.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
  