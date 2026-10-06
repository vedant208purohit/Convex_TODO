/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Chef Prep Preferences Domain Unit & Integration Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_pref_1") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Gourmet Bistro",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  test("1. Create, list, validation, and duplicate rejection", async () => {
    const { asAdmin, orgId, t } = await setupStoreWithAdmin();

    // 1. Create valid preferences
    const pref1Id = await asAdmin.mutation(api.chefPrepPreferences.create, {
      organizationId: orgId,
      name: "No Onion",
    });
    expect(pref1Id).toBeDefined();

    const pref2Id = await asAdmin.mutation(api.chefPrepPreferences.create, {
      organizationId: orgId,
      name: "Extra Spicy",
    });
    expect(pref2Id).toBeDefined();

    // 2. Reject empty or whitespace-only name
    await expect(
      asAdmin.mutation(api.chefPrepPreferences.create, {
        organizationId: orgId,
        name: "   ",
      })
    ).rejects.toThrow("Preference name is required.");

    // 3. Reject name exceeding 32 characters
    await expect(
      asAdmin.mutation(api.chefPrepPreferences.create, {
        organizationId: orgId,
        name: "This is a super long preference name that exceeds thirty two characters limit",
      })
    ).rejects.toThrow("Preference name must not exceed 32 characters.");

    // 4. Reject duplicate preference name within same org (case-insensitive)
    await expect(
      asAdmin.mutation(api.chefPrepPreferences.create, {
        organizationId: orgId,
        name: "no onion",
      })
    ).rejects.toThrow('Duplicate preference "no onion" already exists.');

    // 5. Allow same name in different organization (Multi-tenant isolation)
    const org2Id = await t.mutation(api.organizations.create, {
      name: "Second Restaurant",
      ownerClerkId: "user_admin_pref_2",
    });
    const asAdmin2 = t.withIdentity({ subject: "user_admin_pref_2" });
    const org2PrefId = await asAdmin2.mutation(api.chefPrepPreferences.create, {
      organizationId: org2Id,
      name: "No Onion",
    });
    expect(org2PrefId).toBeDefined();

    // 6. List preferences for orgId
    const org1Prefs = await t.query(api.chefPrepPreferences.list, {
      organizationId: orgId,
    });
    expect(org1Prefs.length).toBe(2);
    expect(org1Prefs.map((p) => p.name)).toContain("No Onion");
    expect(org1Prefs.map((p) => p.name)).toContain("Extra Spicy");

    // Search filter
    const filtered = await t.query(api.chefPrepPreferences.list, {
      organizationId: orgId,
      search: "spicy",
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe("Extra Spicy");
  });

  test("2. Update preference & duplicate validation on rename", async () => {
    const { asAdmin, orgId } = await setupStoreWithAdmin();

    const pref1 = await asAdmin.mutation(api.chefPrepPreferences.create, {
      organizationId: orgId,
      name: "No Garlic",
    });
    const pref2 = await asAdmin.mutation(api.chefPrepPreferences.create, {
      organizationId: orgId,
      name: "Less Spicy",
    });

    // Rename pref1 -> "Zero Garlic"
    await asAdmin.mutation(api.chefPrepPreferences.update, {
      id: pref1,
      name: "Zero Garlic",
    });

    const updated = await asAdmin.query(api.chefPrepPreferences.get, { id: pref1 });
    expect(updated?.name).toBe("Zero Garlic");

    // Attempting to rename pref2 to "zero garlic" (duplicate) -> should fail
    await expect(
      asAdmin.mutation(api.chefPrepPreferences.update, {
        id: pref2,
        name: "zero garlic",
      })
    ).rejects.toThrow('Duplicate preference "zero garlic" already exists.');
  });

  test("3. Menu item linking, unlinking, item preferences, and live metrics", async () => {
    const { asAdmin, orgId, t } = await setupStoreWithAdmin();

    // Create master preferences
    const prefNoOnion = await asAdmin.mutation(api.chefPrepPreferences.create, {
      organizationId: orgId,
      name: "No Onion",
    });
    const prefNoMayo = await asAdmin.mutation(api.chefPrepPreferences.create, {
      organizationId: orgId,
      name: "No Mayo",
    });
    const prefWellDone = await asAdmin.mutation(api.chefPrepPreferences.create, {
      organizationId: orgId,
      name: "Well Done",
    });

    // Create a Menu & Category & Items
    const menuId = await t.mutation(api.menu.createMenu, {
      organizationId: orgId,
      name: "Main Menu",
    });
    const categoryId = await t.mutation(api.menu.createCategory, {
      organizationId: orgId,
      menuId,
      name: "Burgers",
    });
    const burgerItemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Truffle Umami Burger",
      price: 42000,
    });
    await t.mutation(api.menu.addCategoryItem, {
      organizationId: orgId,
      categoryId,
      itemId: burgerItemId,
    });

    const pizzaItemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Margherita Pizza",
      price: 35000,
    });
    await t.mutation(api.menu.addCategoryItem, {
      organizationId: orgId,
      categoryId,
      itemId: pizzaItemId,
    });

    // Initial metrics: 3 preferences, 0 linked items
    let metrics = await t.query(api.chefPrepPreferences.getMetrics, {
      organizationId: orgId,
    });
    expect(metrics.activePreferencesCount).toBe(3);
    expect(metrics.linkedMenuItemsCount).toBe(0);

    // Link "No Onion" and "Well Done" to Truffle Burger
    await asAdmin.mutation(api.chefPrepPreferences.updateItemPreferences, {
      organizationId: orgId,
      itemId: burgerItemId,
      preferenceIds: [prefNoOnion, prefWellDone],
    });

    // Link "No Onion" to Pizza
    await asAdmin.mutation(api.chefPrepPreferences.updateItemPreferences, {
      organizationId: orgId,
      itemId: pizzaItemId,
      preferenceIds: [prefNoOnion],
    });

    // Query item preferences for item setup view
    const itemPrefs = await t.query(api.chefPrepPreferences.getItemPreferences, {
      organizationId: orgId,
      itemId: burgerItemId,
    });
    const linkedForBurger = itemPrefs.filter((p) => p.isLinked).map((p) => p.name);
    expect(linkedForBurger).toEqual(["No Onion", "Well Done"]);

    // Query customer-facing preferences for Truffle Burger
    const customerBurgerPrefs = await t.query(
      api.chefPrepPreferences.getLinkedPreferencesForItem,
      {
        itemId: burgerItemId,
      }
    );
    expect(customerBurgerPrefs.length).toBe(2);
    expect(customerBurgerPrefs.map((p) => p.name)).toEqual(["No Onion", "Well Done"]);

    // Query customer-facing preferences for Pizza
    const customerPizzaPrefs = await t.query(
      api.chefPrepPreferences.getLinkedPreferencesForItem,
      {
        itemId: pizzaItemId,
      }
    );
    expect(customerPizzaPrefs.length).toBe(1);
    expect(customerPizzaPrefs[0].name).toBe("No Onion");

    // Metrics after linking: 3 preferences, 2 linked items
    metrics = await t.query(api.chefPrepPreferences.getMetrics, {
      organizationId: orgId,
    });
    expect(metrics.activePreferencesCount).toBe(3);
    expect(metrics.linkedMenuItemsCount).toBe(2);

    // Usage counts in master list
    const prefList = await t.query(api.chefPrepPreferences.list, {
      organizationId: orgId,
    });
    const noOnionPref = prefList.find((p) => p._id === prefNoOnion);
    const noMayoPref = prefList.find((p) => p._id === prefNoMayo);
    const wellDonePref = prefList.find((p) => p._id === prefWellDone);

    expect(noOnionPref?.usedInItemCount).toBe(2);
    expect(noMayoPref?.usedInItemCount).toBe(0);
    expect(wellDonePref?.usedInItemCount).toBe(1);

    // get preference by ID returns linked items
    const noOnionDetail = await t.query(api.chefPrepPreferences.get, {
      id: prefNoOnion,
    });
    expect(noOnionDetail?.usedInItemCount).toBe(2);
    expect(noOnionDetail?.linkedItems.map((i) => i.name)).toContain("Truffle Umami Burger");
    expect(noOnionDetail?.linkedItems.map((i) => i.name)).toContain("Margherita Pizza");
  });

  test("4. Delete preference cascades cleanup without leaving orphaned records", async () => {
    const { asAdmin, orgId, t } = await setupStoreWithAdmin();

    const pref1 = await asAdmin.mutation(api.chefPrepPreferences.create, {
      organizationId: orgId,
      name: "Extra Cheese",
    });

    const menuId = await t.mutation(api.menu.createMenu, {
      organizationId: orgId,
      name: "Main Menu",
    });
    const catId = await t.mutation(api.menu.createCategory, {
      organizationId: orgId,
      menuId,
      name: "Mains",
    });
    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Cheese Pizza",
      price: 20000,
    });
    await t.mutation(api.menu.addCategoryItem, {
      organizationId: orgId,
      categoryId: catId,
      itemId,
    });

    await asAdmin.mutation(api.chefPrepPreferences.updateItemPreferences, {
      organizationId: orgId,
      itemId,
      preferenceIds: [pref1],
    });

    // Delete preference
    const delResult = await asAdmin.mutation(api.chefPrepPreferences.deletePreference, {
      id: pref1,
    });
    expect(delResult.success).toBe(true);
    expect(delResult.unlinkedCount).toBe(1);

    // Preference is soft-deleted and removed from active list
    const activePrefs = await t.query(api.chefPrepPreferences.list, {
      organizationId: orgId,
    });
    expect(activePrefs.length).toBe(0);

    // Item no longer has active linked preferences
    const itemPrefs = await t.query(api.chefPrepPreferences.getLinkedPreferencesForItem, {
      itemId,
    });
    expect(itemPrefs.length).toBe(0);
  });

  test("5. getOrganizationMenu serializes linked Chef Prep Preferences", async () => {
    const { asAdmin, orgId, t } = await setupStoreWithAdmin();

    const prefSpicy = await asAdmin.mutation(api.chefPrepPreferences.create, {
      organizationId: orgId,
      name: "Medium Spicy",
    });

    const menuId = await t.mutation(api.menu.createMenu, {
      organizationId: orgId,
      name: "Dinner Menu",
      isDefault: true,
      isActive: true,
    });
    const catId = await t.mutation(api.menu.createCategory, {
      organizationId: orgId,
      menuId,
      name: "Specials",
    });
    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Spicy Curry",
      price: 25000,
    });
    await t.mutation(api.menu.addCategoryItem, {
      organizationId: orgId,
      categoryId: catId,
      itemId,
    });

    await asAdmin.mutation(api.chefPrepPreferences.updateItemPreferences, {
      organizationId: orgId,
      itemId,
      preferenceIds: [prefSpicy],
    });

    const orgMenu = await t.query(api.menu.getOrganizationMenu, {
      organizationId: orgId,
    });

    expect(orgMenu.length).toBeGreaterThan(0);
    const category = orgMenu[0].category;
    expect(category.items.length).toBe(1);
    const item = category.items[0];
    expect(item.chefPrepPreferences).toBeDefined();
    expect(item.chefPrepPreferences.length).toBe(1);
    expect(item.chefPrepPreferences[0].name).toBe("Medium Spicy");
  });

  test("6. Order creation persists Chef Prep Preferences on order item", async () => {
    const { asAdmin, orgId, t } = await setupStoreWithAdmin();

    const prefNoOnion = await asAdmin.mutation(api.chefPrepPreferences.create, {
      organizationId: orgId,
      name: "No Onion",
    });

    const menuId = await t.mutation(api.menu.createMenu, {
      organizationId: orgId,
      name: "Lunch",
      isDefault: true,
      isActive: true,
    });
    const catId = await t.mutation(api.menu.createCategory, {
      organizationId: orgId,
      menuId,
      name: "Wraps",
    });
    const itemId = await t.mutation(api.menu.createItem, {
      organizationId: orgId,
      name: "Falafel Wrap",
      price: 15000,
    });
    await t.mutation(api.menu.addCategoryItem, {
      organizationId: orgId,
      categoryId: catId,
      itemId,
    });

    // Create Order with prep preferences
    const orderRes = await asAdmin.mutation(api.orders.createOrder, {
      organizationId: orgId,
      orderType: "DineIn",
      orderSource: "Prest-Cashier",
      paymentMode: "Cash",
      items: [
        {
          itemId,
          quantity: 2,
          prepPreferences: [
            {
              preferenceId: prefNoOnion,
              name: "No Onion",
            },
          ],
        },
      ],
    });

    expect(orderRes.orderId).toBeDefined();

    const orderDetail = await asAdmin.query(api.orders.getOrderDetails, { id: orderRes.orderId });
    expect(orderDetail).toBeDefined();
    expect(orderDetail?.items.length).toBe(1);
    expect(orderDetail?.items[0].prepPreferences).toBeDefined();
    expect(orderDetail?.items[0].prepPreferences?.[0].name).toBe("No Onion");
  });
});
