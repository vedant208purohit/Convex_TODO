/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Organization Languages Domain Unit & Business Logic Tests", () => {
  // Helper: Setup store with an initial admin user
  async function setupStoreWithAdmin(adminClerkId = "user_admin_1") {
    const t = convexTest(schema, modules);

    // Create store organization with initial owner
    const orgId = await t.mutation(api.organizations.create, {
      name: "Spice Garden Store",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  // 1. Creation Tests
  describe("Creation Logic & Validations", () => {
    test("Store Admin can create a language with defaults", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const langId = await asAdmin.mutation(api.organizationLanguages.create, {
        name: "English",
        code: "en",
      });

      expect(langId).toBeDefined();

      const lang = await asAdmin.query(api.organizationLanguages.get, { id: langId });
      expect(lang).not.toBeNull();
      expect(lang?.name).toBe("English");
      expect(lang?.code).toBe("en");
      expect(lang?.isDefault).toBe(false);
    });

    test("Non-admin store member cannot create a language", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      // Create a cashier member
      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_cashier_1",
        userType: ["cashier"],
      });

      const asCashier = t.withIdentity({ subject: "user_cashier_1" });

      await expect(
        asCashier.mutation(api.organizationLanguages.create, {
          name: "French",
          code: "fr",
        })
      ).rejects.toThrow("Forbidden. Admin access required.");
    });

    test("Unauthenticated user cannot create a language", async () => {
      const { t } = await setupStoreWithAdmin();

      await expect(
        t.mutation(api.organizationLanguages.create, {
          name: "Spanish",
          code: "es",
        })
      ).rejects.toThrow("Unauthenticated");
    });

    test("Blank or whitespace-only name is rejected", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await expect(
        asAdmin.mutation(api.organizationLanguages.create, {
          name: "",
          code: "en",
        })
      ).rejects.toThrow("Name can't be blank");

      await expect(
        asAdmin.mutation(api.organizationLanguages.create, {
          name: "   ",
          code: "en",
        })
      ).rejects.toThrow("Name can't be blank");
    });

    test("Blank or whitespace-only code is rejected", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await expect(
        asAdmin.mutation(api.organizationLanguages.create, {
          name: "English",
          code: "",
        })
      ).rejects.toThrow("Code can't be blank");

      await expect(
        asAdmin.mutation(api.organizationLanguages.create, {
          name: "English",
          code: "   ",
        })
      ).rejects.toThrow("Code can't be blank");
    });

    test("Duplicate active name is rejected case-insensitively", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationLanguages.create, {
        name: "English",
        code: "en",
      });

      await expect(
        asAdmin.mutation(api.organizationLanguages.create, {
          name: "english",
          code: "en-us",
        })
      ).rejects.toThrow("Hey! english is already taken.");
    });

    test("Duplicate active code is rejected case-insensitively", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationLanguages.create, {
        name: "English",
        code: "en",
      });

      await expect(
        asAdmin.mutation(api.organizationLanguages.create, {
          name: "English US",
          code: "EN",
        })
      ).rejects.toThrow("Hey! EN is already taken.");
    });

    test("Soft-deleted name and code can be reused for new languages", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const oldLangId = await asAdmin.mutation(api.organizationLanguages.create, {
        name: "Arabic",
        code: "ar",
      });

      // Soft delete the language
      await asAdmin.mutation(api.organizationLanguages.remove, { id: oldLangId });

      // Creating a new language with the same name and code is allowed
      const newLangId = await asAdmin.mutation(api.organizationLanguages.create, {
        name: "Arabic",
        code: "ar",
      });

      expect(newLangId).toBeDefined();
      const newLang = await asAdmin.query(api.organizationLanguages.get, { id: newLangId });
      expect(newLang?.name).toBe("Arabic");
    });
  });

  // 2. Listing & Reading Tests
  describe("Listing & Get Operations", () => {
    test("Active languages are returned and soft-deleted languages are excluded", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const lang1 = await asAdmin.mutation(api.organizationLanguages.create, {
        name: "English",
        code: "en",
      });

      const lang2 = await asAdmin.mutation(api.organizationLanguages.create, {
        name: "Arabic",
        code: "ar",
      });

      let listRes = await asAdmin.query(api.organizationLanguages.list, {});
      expect(listRes).toHaveLength(2);

      // Soft delete lang1
      await asAdmin.mutation(api.organizationLanguages.remove, { id: lang1 });

      listRes = await asAdmin.query(api.organizationLanguages.list, {});
      expect(listRes).toHaveLength(1);
      expect(listRes[0]._id).toBe(lang2);
    });

    test("Get returns active language and returns null for missing or soft-deleted language", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const langId = await asAdmin.mutation(api.organizationLanguages.create, {
        name: "Hindi",
        code: "hi",
      });

      const activeLang = await asAdmin.query(api.organizationLanguages.get, { id: langId });
      expect(activeLang?.name).toBe("Hindi");

      await asAdmin.mutation(api.organizationLanguages.remove, { id: langId });

      const deletedLang = await asAdmin.query(api.organizationLanguages.get, { id: langId });
      expect(deletedLang).toBeNull();
    });

    test("getByCode fetches active language case-insensitively", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationLanguages.create, {
        name: "German",
        code: "de",
      });

      const match = await asAdmin.query(api.organizationLanguages.getByCode, { code: "DE" });
      expect(match?.name).toBe("German");
    });
  });

  // 3. Update Operations
  describe("Update Logic & Validations", () => {
    test("Admin can update language name and code", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const langId = await asAdmin.mutation(api.organizationLanguages.create, {
        name: "Englsh",
        code: "eg",
      });

      await asAdmin.mutation(api.organizationLanguages.update, {
        id: langId,
        name: "English",
        code: "en",
      });

      const updated = await asAdmin.query(api.organizationLanguages.get, { id: langId });
      expect(updated?.name).toBe("English");
      expect(updated?.code).toBe("en");
    });

    test("Update validates duplicate name and code", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationLanguages.create, {
        name: "English",
        code: "en",
      });

      const lang2 = await asAdmin.mutation(api.organizationLanguages.create, {
        name: "Spanish",
        code: "es",
      });

      await expect(
        asAdmin.mutation(api.organizationLanguages.update, {
          id: lang2,
          name: "english",
        })
      ).rejects.toThrow("Hey! english is already taken.");

      await expect(
        asAdmin.mutation(api.organizationLanguages.update, {
          id: lang2,
          code: "EN",
        })
      ).rejects.toThrow("Hey! EN is already taken.");
    });

    test("Updating a record to its own current name/code succeeds", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const langId = await asAdmin.mutation(api.organizationLanguages.create, {
        name: "Italian",
        code: "it",
      });

      // Updating with same values (case-preserved or changed case)
      await asAdmin.mutation(api.organizationLanguages.update, {
        id: langId,
        name: "ITALIAN",
        code: "IT",
      });

      const updated = await asAdmin.query(api.organizationLanguages.get, { id: langId });
      expect(updated?.name).toBe("ITALIAN");
    });

    test("Soft-deleted language cannot be updated", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const langId = await asAdmin.mutation(api.organizationLanguages.create, {
        name: "Dutch",
        code: "nl",
      });

      await asAdmin.mutation(api.organizationLanguages.remove, { id: langId });

      await expect(
        asAdmin.mutation(api.organizationLanguages.update, {
          id: langId,
          name: "New Dutch",
        })
      ).rejects.toThrow("Language not found");
    });
  });

  // 4. Default Language Logic
  describe("Default Language Behavior & Exclusivity", () => {
    test("Language can be created as default", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const langId = await asAdmin.mutation(api.organizationLanguages.create, {
        name: "English",
        code: "en",
        isDefault: true,
      });

      const lang = await asAdmin.query(api.organizationLanguages.get, { id: langId });
      expect(lang?.isDefault).toBe(true);
    });

    test("Creating a new default unsets the previous active default", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const lang1 = await asAdmin.mutation(api.organizationLanguages.create, {
        name: "English",
        code: "en",
        isDefault: true,
      });

      const lang2 = await asAdmin.mutation(api.organizationLanguages.create, {
        name: "Arabic",
        code: "ar",
        isDefault: true,
      });

      const res1 = await asAdmin.query(api.organizationLanguages.get, { id: lang1 });
      const res2 = await asAdmin.query(api.organizationLanguages.get, { id: lang2 });

      expect(res1?.isDefault).toBe(false);
      expect(res2?.isDefault).toBe(true);
    });

    test("setDefault mutation changes default and is idempotent", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const lang1 = await asAdmin.mutation(api.organizationLanguages.create, {
        name: "English",
        code: "en",
        isDefault: true,
      });

      const lang2 = await asAdmin.mutation(api.organizationLanguages.create, {
        name: "Hindi",
        code: "hi",
        isDefault: false,
      });

      // Change default to lang2
      await asAdmin.mutation(api.organizationLanguages.setDefault, { id: lang2 });

      let res1 = await asAdmin.query(api.organizationLanguages.get, { id: lang1 });
      let res2 = await asAdmin.query(api.organizationLanguages.get, { id: lang2 });

      expect(res1?.isDefault).toBe(false);
      expect(res2?.isDefault).toBe(true);

      // Calling setDefault on lang2 again is idempotent
      await asAdmin.mutation(api.organizationLanguages.setDefault, { id: lang2 });
      res2 = await asAdmin.query(api.organizationLanguages.get, { id: lang2 });
      expect(res2?.isDefault).toBe(true);
    });

    test("Setting isDefault = false on update allows zero active defaults", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const langId = await asAdmin.mutation(api.organizationLanguages.create, {
        name: "English",
        code: "en",
        isDefault: true,
      });

      await asAdmin.mutation(api.organizationLanguages.update, {
        id: langId,
        isDefault: false,
      });

      const lang = await asAdmin.query(api.organizationLanguages.get, { id: langId });
      expect(lang?.isDefault).toBe(false);

      const listRes = await asAdmin.query(api.organizationLanguages.list, {});
      const activeDefaults = listRes.filter((l) => l.isDefault);
      expect(activeDefaults).toHaveLength(0);
    });

    test("Soft deleting the default language clears its default status without auto-assigning a new default", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const lang1 = await asAdmin.mutation(api.organizationLanguages.create, {
        name: "English",
        code: "en",
        isDefault: true,
      });

      const lang2 = await asAdmin.mutation(api.organizationLanguages.create, {
        name: "French",
        code: "fr",
        isDefault: false,
      });

      await asAdmin.mutation(api.organizationLanguages.remove, { id: lang1 });

      const listRes = await asAdmin.query(api.organizationLanguages.list, {});
      expect(listRes).toHaveLength(1);
      expect(listRes[0]._id).toBe(lang2);
      expect(listRes[0].isDefault).toBe(false);
    });
  });

  // 5. Migration Compatibility Tests
  describe("Migration Traceability & Attributes", () => {
    test("Supports legacyId, createdAt, updatedAt, deletedAt timestamps", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const legacyUuid = "a1b2c3d4-e5f6-7890-1234-56789abcdef0";
      const customCreatedAt = 1672531199000;

      const langId = await asAdmin.mutation(api.organizationLanguages.create, {
        name: "Japanese",
        code: "ja",
        legacyId: legacyUuid,
        createdAt: customCreatedAt,
      });

      const lang = await asAdmin.query(api.organizationLanguages.get, { id: langId });
      expect(lang?.legacyId).toBe(legacyUuid);
      expect(lang?.createdAt).toBe(customCreatedAt);
    });
  });
});
