/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Organization Bot Tokens Domain Unit & Integration Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_bot_test") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Bot Token Test Store",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  // 1. Creation & Provisioning
  describe("Creation & Provisioning", () => {
    test("Creation auto-generates unique token UUID and provisions Bot User membership", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      const created = await asAdmin.mutation(api.organizationBotTokens.create, {
        env: "production",
      });

      expect(created).toBeDefined();
      expect(created.token).toBeDefined();
      expect(created.token.length).toBeGreaterThanOrEqual(32);
      expect(created.env).toBe("production");
      expect(created.userId).toBeDefined();
      expect(created.userId).toContain("bot_user_");

      // Verify organizationUsers record was created for bot
      const orgUsers = await asAdmin.query(api.organizationUsers.list, {
        includeCustomers: true,
      });
      const botMember = orgUsers.find((u) => u.userId === created.userId);
      expect(botMember).toBeDefined();
      expect(botMember?.userType).toContain("bot");
    });

    test("Creation with explicit token string enforces uniqueness", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const token1 = await asAdmin.mutation(
        api.organizationBotTokens.create,
        {
          token: "custom-secret-token-12345",
          env: "staging",
        }
      );

      expect(token1.token).toBe("custom-secret-token-12345");
      expect(token1.env).toBe("staging");
    });
  });

  // 2. V4 Token Authentication Validation
  describe("V4 Token Authentication Validation", () => {
    test("validateBotToken returns valid status for active token", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      const created = await asAdmin.mutation(api.organizationBotTokens.create, {
        env: "production",
      });

      const validation = await t.query(
        api.organizationBotTokens.validateBotToken,
        { token: created.token }
      );

      expect(validation.valid).toBe(true);
      expect(validation.botTokenId).toBe(created._id);
      expect(validation.userId).toBe(created.userId);
      expect(validation.organization?.name).toBe("Bot Token Test Store");
    });

    test("validateBotToken rejects invalid or non-existent tokens", async () => {
      const { t } = await setupStoreWithAdmin();

      const validation = await t.query(
        api.organizationBotTokens.validateBotToken,
        { token: "non-existent-token-xyz" }
      );

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe("Invalid or revoked token");
    });

    test("validateBotToken rejects revoked/soft-deleted tokens", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      const created = await asAdmin.mutation(api.organizationBotTokens.create, {
        env: "staging",
      });

      // Soft delete token
      await asAdmin.mutation(api.organizationBotTokens.remove, {
        id: created._id,
      });

      const validation = await t.query(
        api.organizationBotTokens.validateBotToken,
        { token: created.token }
      );

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe("Invalid or revoked token");
    });
  });

  // 3. Queries & Updates
  describe("Queries & Updates", () => {
    test("list returns active bot tokens ordered by creation date DESC", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationBotTokens.create, {
        env: "dev",
      });
      await asAdmin.mutation(api.organizationBotTokens.create, {
        env: "prod",
      });

      const list = await asAdmin.query(api.organizationBotTokens.list, {});
      expect(list.length).toBe(2);
      expect(list[0].env).toBe("prod");
      expect(list[1].env).toBe("dev");
    });

    test("update modifies env designation without altering token string", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const created = await asAdmin.mutation(api.organizationBotTokens.create, {
        env: "dev",
      });

      const updated = await asAdmin.mutation(api.organizationBotTokens.update, {
        id: created._id,
        env: "production",
      });

      expect(updated.env).toBe("production");
      expect(updated.token).toBe(created.token);
      expect(updated.userId).toBe(created.userId);
    });

    test("remove soft-deletes bot token and excludes it from active list", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const created = await asAdmin.mutation(api.organizationBotTokens.create, {
        env: "staging",
      });

      await asAdmin.mutation(api.organizationBotTokens.remove, {
        id: created._id,
      });

      const list = await asAdmin.query(api.organizationBotTokens.list, {});
      expect(list.some((t) => t._id === created._id)).toBe(false);
    });
  });

  // 4. Authorization Boundary Checks
  describe("Authorization Boundary Checks", () => {
    test("Staff/Waiter role cannot create, update, or remove bot tokens", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_waiter_99",
        userType: ["waiter"],
      });

      const asWaiter = t.withIdentity({ subject: "user_waiter_99" });

      const list = await asWaiter.query(api.organizationBotTokens.list, {});
      expect(Array.isArray(list)).toBe(true);

      await expect(
        asWaiter.mutation(api.organizationBotTokens.create, {
          env: "forbidden",
        })
      ).rejects.toThrow("Forbidden. Admin or Cashier access required.");
    });
  });
});
