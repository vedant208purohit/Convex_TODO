import { StoreDeploymentRunnerParams, runStoreDeployment } from "./deployment-runner";

export async function triggerStoreDeployment(
  params: StoreDeploymentRunnerParams
): Promise<{ dispatched: boolean; target: "github" | "local"; message: string }> {
  const githubToken =
    process.env.GITHUB_TOKEN || process.env.GITHUB_DISPATCH_TOKEN;
  const githubRepo =
    process.env.GITHUB_REPOSITORY || "vedant208purohit/Convex_TODO";

  if (githubToken && githubRepo) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${githubRepo}/dispatches`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "pos-master-app",
          },
          body: JSON.stringify({
            event_type: "deploy_store_backend",
            client_payload: {
              masterOrgId: params.masterOrgId,
              name: params.name,
              slug: params.slug,
              legacyOrganizationId: params.legacyOrganizationId,
              ownerClerkId: params.ownerClerkId,
              projectId: params.projectId,
              deploymentId: params.deploymentId,
              deploymentUrl: params.deploymentUrl,
              phone: params.phone,
              addressLine1: params.addressLine1,
              city: params.city,
              state: params.state,
              country: params.country,
              zipCode: params.zipCode,
              latitude: params.latitude,
              longitude: params.longitude,
            },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.warn(
          `GitHub dispatch returned ${response.status}: ${errText}. Falling back to local execution.`
        );
      } else {
        return {
          dispatched: true,
          target: "github",
          message: "Dispatched deployment workflow via GitHub Actions.",
        };
      }
    } catch (err: any) {
      console.warn(
        `GitHub dispatch failed: ${err.message}. Falling back to local execution.`
      );
    }
  }

  // Fallback to async local execution for local dev and tests
  if (typeof setImmediate !== "undefined") {
    setImmediate(() => {
      runStoreDeployment(params).catch((err) => {
        console.error("Async local deployment execution error:", err);
      });
    });
  } else {
    setTimeout(() => {
      runStoreDeployment(params).catch((err) => {
        console.error("Async local deployment execution error:", err);
      });
    }, 0);
  }

  return {
    dispatched: true,
    target: "local",
    message: "Triggered background store deployment runner locally.",
  };
}
