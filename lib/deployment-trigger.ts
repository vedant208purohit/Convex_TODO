import { StoreDeploymentRunnerParams, runStoreDeployment } from "./deployment-runner";

export interface TriggerResult {
  dispatched: boolean;
  target: "github" | "local";
  message: string;
}

export async function triggerStoreDeployment(
  params: StoreDeploymentRunnerParams
): Promise<TriggerResult> {
  const githubToken =
    process.env.GITHUB_TOKEN || process.env.GITHUB_DISPATCH_TOKEN;
  const githubRepo =
    process.env.GITHUB_REPOSITORY?.trim() || "joshidhruv/pos-master";
  const targetRef =
    process.env.VERCEL_GIT_COMMIT_REF?.trim() ||
    process.env.GITHUB_REF_NAME?.trim() ||
    "development";

  console.log(
    `[Master API] Initiating store deployment trigger for orgId: ${params.masterOrgId} (slug: ${params.slug}, target: ${githubToken ? "GitHub Actions" : "Local Runner"})`
  );

  if (githubToken) {
    const workflowUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/deploy-store-backend.yml/dispatches`;

    console.log(
      `[GitHub Dispatch] Target Repo: ${githubRepo}, Workflow: deploy-store-backend.yml, Ref: ${targetRef}`
    );

    try {
      const response = await fetch(workflowUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "pos-master-app",
        },
        body: JSON.stringify({
          ref: targetRef,
          inputs: {
            masterOrgId: params.masterOrgId,
            name: params.name,
            slug: params.slug,
            legacyOrganizationId: params.legacyOrganizationId || "",
            ownerClerkId: params.ownerClerkId || "",
            projectId: params.projectId,
            deploymentId: params.deploymentId,
            deploymentUrl: params.deploymentUrl,
            phone: params.phone || "",
            addressLine1: params.addressLine1 || "",
            city: params.city || "",
            state: params.state || "",
            country: params.country || "",
            zipCode: params.zipCode || "",
            latitude: params.latitude ? String(params.latitude) : "",
            longitude: params.longitude ? String(params.longitude) : "",
          },
        }),
      });

      console.log(
        `[GitHub Dispatch Response] Repo: ${githubRepo}, Ref: ${targetRef}, HTTP Status: ${response.status}`
      );

      if (!response.ok) {
        const errText = await response.text();
        const errorMessage = `GitHub workflow_dispatch returned HTTP ${response.status}: ${errText}`;
        console.error(`[GitHub Dispatch Error] ${errorMessage}`);

        // Also attempt repository_dispatch fallback
        const repoDispatchUrl = `https://api.github.com/repos/${githubRepo}/dispatches`;
        const fallbackRes = await fetch(repoDispatchUrl, {
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
            },
          }),
        });

        if (fallbackRes.ok) {
          console.log(`[GitHub Fallback Dispatch] repository_dispatch succeeded with HTTP ${fallbackRes.status}`);
          return {
            dispatched: true,
            target: "github",
            message: "Dispatched deployment workflow via repository_dispatch fallback.",
          };
        }

        throw new Error(errorMessage);
      }

      return {
        dispatched: true,
        target: "github",
        message: `Dispatched deployment workflow via GitHub Actions workflow_dispatch on ref: ${targetRef}.`,
      };
    } catch (err: any) {
      console.error(`[GitHub Dispatch Failure] ${err.message}`);
      throw err;
    }
  }

  // Fallback to async local execution for local development and unit tests
  console.log(`[Local Runner] GITHUB_TOKEN not configured. Executing background local deployment runner.`);

  if (typeof setImmediate !== "undefined") {
    setImmediate(() => {
      runStoreDeployment(params).catch((err) => {
        console.error("[Local Runner Exception]", err);
      });
    });
  } else {
    setTimeout(() => {
      runStoreDeployment(params).catch((err) => {
        console.error("[Local Runner Exception]", err);
      });
    }, 0);
  }

  return {
    dispatched: true,
    target: "local",
    message: "Triggered background store deployment runner locally.",
  };
}
