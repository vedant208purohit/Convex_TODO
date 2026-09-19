/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("International Taxation Engine & isGst Integration", () => {
  test("1. India (IN) Auto Setup: Split 5% GST (2.5% CGST + 2.5% SGST)", async () => {
    const t = convexTest(schema, modules);

    // Create Org
    const orgId = await t.mutation(api.organizations.create, {
      name: "Tandoori Nights India",
    });

    // Run Auto Setup for India
    const setupResult = await t.mutation(api.taxation.autoSetupStoreTaxation, {
      organizationId: orgId,
      countryCode: "IN",
    });

    expect(setupResult.countryCode).toBe("IN");
    expect(setupResult.currencyCode).toBe("INR");
    expect(setupResult.currencySymbol).toBe("₹");

    // Fetch tax components
    const components = await t.query(api.taxation.listTaxComponents, {
      organizationId: orgId,
    });
    expect(components).toHaveLength(2);
    expect(components.map((c: any) => c.name)).toContain("CGST");
    expect(components.map((c: any) => c.name)).toContain("SGST");

    // Test Item Tax Calculation for ₹250.00 Paneer Tikka (isGst = true)
    const taxCalc = await t.query(api.taxation.calculateItemTax, {
      organizationId: orgId,
      price: 25000,
      isGst: true,
      taxGroupId: setupResult.taxGroupId,
    });

    expect(taxCalc.is_gst).toBe(true);
    expect(taxCalc.tax_mode).toBe("inclusive");
    expect(taxCalc.total_tax_rate).toBe(5);
    expect(taxCalc.components).toHaveLength(2);
  });

  test("2. USA (US) Auto Setup: 8.5% Exclusive Sales Tax", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "NYC Diner USA",
    });

    const setupResult = await t.mutation(api.taxation.autoSetupStoreTaxation, {
      organizationId: orgId,
      countryCode: "US",
    });

    expect(setupResult.countryCode).toBe("US");
    expect(setupResult.currencyCode).toBe("USD");
    expect(setupResult.currencySymbol).toBe("$");

    // Calculate tax for $100.00 burger (isGst = true)
    const taxCalc = await t.query(api.taxation.calculateItemTax, {
      organizationId: orgId,
      price: 10000,
      isGst: true,
      taxGroupId: setupResult.taxGroupId,
    });

    expect(taxCalc.is_gst).toBe(true);
    expect(taxCalc.tax_mode).toBe("exclusive");
    expect(taxCalc.total_tax_rate).toBe(8.5);
    expect(taxCalc.tax_amount).toBe("8.50");
    expect(taxCalc.final_price).toBe("108.50");
  });

  test("3. UK Auto Setup: 20% Inclusive VAT", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "London Pub UK",
    });

    const setupResult = await t.mutation(api.taxation.autoSetupStoreTaxation, {
      organizationId: orgId,
      countryCode: "UK",
    });

    expect(setupResult.countryCode).toBe("UK");
    expect(setupResult.currencyCode).toBe("GBP");
    expect(setupResult.currencySymbol).toBe("£");

    // Calculate tax for £12.00 Fish & Chips (isGst = true, VAT inclusive)
    const taxCalc = await t.query(api.taxation.calculateItemTax, {
      organizationId: orgId,
      price: 1200,
      isGst: true,
      taxGroupId: setupResult.taxGroupId,
    });

    expect(taxCalc.is_gst).toBe(true);
    expect(taxCalc.tax_mode).toBe("inclusive");
    expect(taxCalc.total_tax_rate).toBe(20);
    expect(taxCalc.final_price).toBe("12.00");
    expect(parseFloat(taxCalc.tax_amount)).toBeCloseTo(2.0, 1);
  });

  test("4. Item with isGst = false Returns Zero Tax", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Exempt Grocery",
    });

    await t.mutation(api.taxation.autoSetupStoreTaxation, {
      organizationId: orgId,
      countryCode: "US",
    });

    const taxCalc = await t.query(api.taxation.calculateItemTax, {
      organizationId: orgId,
      price: 5000,
      isGst: false, // Tax Exempt Item!
    });

    expect(taxCalc.is_gst).toBe(false);
    expect(taxCalc.total_tax_rate).toBe(0);
    expect(taxCalc.tax_amount).toBe("0.00");
    expect(taxCalc.final_price).toBe("50.00");
  });

  test("5. Tax Component Update and Delete Operations", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Tax Component Test Store",
    });

    // 1. Create component
    const compId = await t.mutation(api.taxation.createTaxComponent, {
      organizationId: orgId,
      name: "State Tax",
      rate: 5.0,
      code: "STAX",
    });

    // 2. Update component name, rate, code
    const updateRes = await t.mutation(api.taxation.updateTaxComponent, {
      id: compId,
      name: "Updated State Tax",
      rate: 6.5,
      code: "STAX_NEW",
    });
    expect(updateRes.success).toBe(true);

    const components = await t.query(api.taxation.listTaxComponents, {
      organizationId: orgId,
    });
    expect(components).toHaveLength(1);
    expect(components[0].name).toBe("Updated State Tax");
    expect(components[0].rate).toBe(6.5);
    expect(components[0].code).toBe("STAX_NEW");

    // 3. Delete component (not referenced by any group)
    const deleteRes = await t.mutation(api.taxation.removeTaxComponent, {
      id: compId,
    });
    expect(deleteRes.success).toBe(true);

    const afterDelete = await t.query(api.taxation.listTaxComponents, {
      organizationId: orgId,
    });
    expect(afterDelete).toHaveLength(0);
  });

  test("6. Prevent Deletion of Tax Component Referenced in Tax Group", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Referenced Component Store",
    });

    const compId = await t.mutation(api.taxation.createTaxComponent, {
      organizationId: orgId,
      name: "CGST",
      rate: 2.5,
    });

    await t.mutation(api.taxation.createTaxGroup, {
      organizationId: orgId,
      name: "GST 5%",
      taxMode: "inclusive",
      componentIds: [compId],
    });

    // Attempting to delete referenced component throws error
    await expect(
      t.mutation(api.taxation.removeTaxComponent, { id: compId })
    ).rejects.toThrow("Cannot delete tax component because it is referenced by one or more tax groups");
  });

  test("7. Tax Group Update & Default Flag Exclusivity", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Tax Group Exclusivity Store",
    });

    const compId = await t.mutation(api.taxation.createTaxComponent, {
      organizationId: orgId,
      name: "VAT",
      rate: 10.0,
    });

    // Create Group 1 (isDefault = true)
    const group1Id = await t.mutation(api.taxation.createTaxGroup, {
      organizationId: orgId,
      name: "Group 1",
      taxMode: "inclusive",
      componentIds: [compId],
      isDefault: true,
    });

    // Create Group 2 (isDefault = false)
    const group2Id = await t.mutation(api.taxation.createTaxGroup, {
      organizationId: orgId,
      name: "Group 2",
      taxMode: "exclusive",
      componentIds: [compId],
      isDefault: false,
    });

    let groups = await t.query(api.taxation.listTaxGroups, { organizationId: orgId });
    expect(groups.find((g: any) => g._id === group1Id)?.isDefault).toBe(true);
    expect(groups.find((g: any) => g._id === group2Id)?.isDefault).toBe(false);

    // Update Group 2: name, taxMode, and set isDefault = true
    await t.mutation(api.taxation.updateTaxGroup, {
      id: group2Id,
      name: "Updated Group 2",
      taxMode: "inclusive",
      isDefault: true,
    });

    groups = await t.query(api.taxation.listTaxGroups, { organizationId: orgId });
    const g1 = groups.find((g: any) => g._id === group1Id);
    const g2 = groups.find((g: any) => g._id === group2Id);

    expect(g2?.name).toBe("Updated Group 2");
    expect(g2?.taxMode).toBe("inclusive");
    expect(g2?.isDefault).toBe(true);
    // Group 1 should be unset from default
    expect(g1?.isDefault).toBe(false);
  });

  test("8. Tax Group Removal and Protection of Default Store Tax Settings Reference", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Store Tax Settings Protection Store",
    });

    const setupResult = await t.mutation(api.taxation.autoSetupStoreTaxation, {
      organizationId: orgId,
      countryCode: "US",
    });

    // Default tax group created by autoSetupStoreTaxation is referenced in storeTaxSettings
    await expect(
      t.mutation(api.taxation.removeTaxGroup, { id: setupResult.taxGroupId })
    ).rejects.toThrow("Cannot delete tax group referenced as default in store tax settings");

    // Non-referenced group can be deleted
    const compId = await t.mutation(api.taxation.createTaxComponent, {
      organizationId: orgId,
      name: "Extra Tax",
      rate: 1.0,
    });

    const standaloneGroupId = await t.mutation(api.taxation.createTaxGroup, {
      organizationId: orgId,
      name: "Standalone Group",
      taxMode: "exclusive",
      componentIds: [compId],
      isDefault: false,
    });

    const deleteRes = await t.mutation(api.taxation.removeTaxGroup, {
      id: standaloneGroupId,
    });
    expect(deleteRes.success).toBe(true);
  });

  test("9. Cross-Organization Security Guard Rejects Unauthorized Access", async () => {
    const t = convexTest(schema, modules);

    const orgAId = await t.mutation(api.organizations.create, {
      name: "Org A",
      ownerClerkId: "user_owner_a",
    });

    const orgBId = await t.mutation(api.organizations.create, {
      name: "Org B",
      ownerClerkId: "user_owner_b",
    });

    const compBId = await t.mutation(api.taxation.createTaxComponent, {
      organizationId: orgBId,
      name: "Org B Component",
      rate: 5.0,
    });

    const groupBId = await t.mutation(api.taxation.createTaxGroup, {
      organizationId: orgBId,
      name: "Org B Group",
      taxMode: "exclusive",
      componentIds: [compBId],
    });

    // Caller authenticated as User Owner A attempting to modify Org B's tax records
    const callerOrgA = t.withIdentity({
      name: "User Owner A",
      subject: "user_owner_a",
    });

    await expect(
      callerOrgA.mutation(api.taxation.updateTaxGroup, {
        id: groupBId,
        name: "Hacked Group",
      })
    ).rejects.toThrow("Forbidden. Cross-organization access denied.");

    await expect(
      callerOrgA.mutation(api.taxation.removeTaxGroup, {
        id: groupBId,
      })
    ).rejects.toThrow("Forbidden. Cross-organization access denied.");

    await expect(
      callerOrgA.mutation(api.taxation.updateTaxComponent, {
        id: compBId,
        rate: 99.0,
      })
    ).rejects.toThrow("Forbidden. Cross-organization access denied.");

    await expect(
      callerOrgA.mutation(api.taxation.removeTaxComponent, {
        id: compBId,
      })
    ).rejects.toThrow("Forbidden. Cross-organization access denied.");
  });
});
