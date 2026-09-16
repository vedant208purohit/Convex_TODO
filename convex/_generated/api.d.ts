/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assetResolver from "../assetResolver.js";
import type * as customers from "../customers.js";
import type * as deliveryProvider from "../deliveryProvider.js";
import type * as digitalStoreImages from "../digitalStoreImages.js";
import type * as features from "../features.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as menu from "../menu.js";
import type * as menuImport from "../menuImport.js";
import type * as migrateStorageToR2 from "../migrateStorageToR2.js";
import type * as migrateStorageToR2Db from "../migrateStorageToR2Db.js";
import type * as orderDeliverStatuses from "../orderDeliverStatuses.js";
import type * as orderDelivers from "../orderDelivers.js";
import type * as orderPayments from "../orderPayments.js";
import type * as orders from "../orders.js";
import type * as organizationAssets from "../organizationAssets.js";
import type * as organizationBotTokens from "../organizationBotTokens.js";
import type * as organizationCarouselScreens from "../organizationCarouselScreens.js";
import type * as organizationFeatures from "../organizationFeatures.js";
import type * as organizationLanguages from "../organizationLanguages.js";
import type * as organizationLayouts from "../organizationLayouts.js";
import type * as organizationOrderProcesses from "../organizationOrderProcesses.js";
import type * as organizationPaymentModes from "../organizationPaymentModes.js";
import type * as organizationPrinters from "../organizationPrinters.js";
import type * as organizationQrCodes from "../organizationQrCodes.js";
import type * as organizationQueueConfigurations from "../organizationQueueConfigurations.js";
import type * as organizationQueues from "../organizationQueues.js";
import type * as organizationSchedulePickups from "../organizationSchedulePickups.js";
import type * as organizationTables from "../organizationTables.js";
import type * as organizationUsers from "../organizationUsers.js";
import type * as organizationWaiters from "../organizationWaiters.js";
import type * as organizations from "../organizations.js";
import type * as postpaidOrderRequests from "../postpaidOrderRequests.js";
import type * as processNotifications from "../processNotifications.js";
import type * as providerPaymentTransfers from "../providerPaymentTransfers.js";
import type * as r2 from "../r2.js";
import type * as r2SignedUrl from "../r2SignedUrl.js";
import type * as surveyAttempts from "../surveyAttempts.js";
import type * as surveyQuestions from "../surveyQuestions.js";
import type * as surveys from "../surveys.js";
import type * as taxation from "../taxation.js";
import type * as userAddresses from "../userAddresses.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assetResolver: typeof assetResolver;
  customers: typeof customers;
  deliveryProvider: typeof deliveryProvider;
  digitalStoreImages: typeof digitalStoreImages;
  features: typeof features;
  http: typeof http;
  inventory: typeof inventory;
  menu: typeof menu;
  menuImport: typeof menuImport;
  migrateStorageToR2: typeof migrateStorageToR2;
  migrateStorageToR2Db: typeof migrateStorageToR2Db;
  orderDeliverStatuses: typeof orderDeliverStatuses;
  orderDelivers: typeof orderDelivers;
  orderPayments: typeof orderPayments;
  orders: typeof orders;
  organizationAssets: typeof organizationAssets;
  organizationBotTokens: typeof organizationBotTokens;
  organizationCarouselScreens: typeof organizationCarouselScreens;
  organizationFeatures: typeof organizationFeatures;
  organizationLanguages: typeof organizationLanguages;
  organizationLayouts: typeof organizationLayouts;
  organizationOrderProcesses: typeof organizationOrderProcesses;
  organizationPaymentModes: typeof organizationPaymentModes;
  organizationPrinters: typeof organizationPrinters;
  organizationQrCodes: typeof organizationQrCodes;
  organizationQueueConfigurations: typeof organizationQueueConfigurations;
  organizationQueues: typeof organizationQueues;
  organizationSchedulePickups: typeof organizationSchedulePickups;
  organizationTables: typeof organizationTables;
  organizationUsers: typeof organizationUsers;
  organizationWaiters: typeof organizationWaiters;
  organizations: typeof organizations;
  paymentModes: typeof paymentModes;
  postpaidOrderRequests: typeof postpaidOrderRequests;
  processNotifications: typeof processNotifications;
  providerPaymentTransfers: typeof providerPaymentTransfers;
  r2: typeof r2;
  r2SignedUrl: typeof r2SignedUrl;
  surveyAttempts: typeof surveyAttempts;
  surveyQuestions: typeof surveyQuestions;
  surveys: typeof surveys;
  taxation: typeof taxation;
  userAddresses: typeof userAddresses;
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
