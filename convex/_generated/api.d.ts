/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as menu from "../menu.js";
import type * as organizationCarouselScreens from "../organizationCarouselScreens.js";
import type * as organizationFeatures from "../organizationFeatures.js";
import type * as organizationLanguages from "../organizationLanguages.js";
import type * as organizationLayouts from "../organizationLayouts.js";
import type * as organizationOrderProcesses from "../organizationOrderProcesses.js";
import type * as organizationPrinters from "../organizationPrinters.js";
import type * as organizationQrCodes from "../organizationQrCodes.js";
import type * as organizationQueueConfigurations from "../organizationQueueConfigurations.js";
import type * as organizationQueues from "../organizationQueues.js";
import type * as organizationTables from "../organizationTables.js";
import type * as organizationUsers from "../organizationUsers.js";
import type * as organizationWaiters from "../organizationWaiters.js";
import type * as organizations from "../organizations.js";
import type * as taxation from "../taxation.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  menu: typeof menu;
  organizationCarouselScreens: typeof organizationCarouselScreens;
  organizationFeatures: typeof organizationFeatures;
  organizationLanguages: typeof organizationLanguages;
  organizationLayouts: typeof organizationLayouts;
  organizationOrderProcesses: typeof organizationOrderProcesses;
  organizationPrinters: typeof organizationPrinters;
  organizationQrCodes: typeof organizationQrCodes;
  organizationQueueConfigurations: typeof organizationQueueConfigurations;
  organizationQueues: typeof organizationQueues;
  organizationTables: typeof organizationTables;
  organizationUsers: typeof organizationUsers;
  organizationWaiters: typeof organizationWaiters;
  organizations: typeof organizations;
  taxation: typeof taxation;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
