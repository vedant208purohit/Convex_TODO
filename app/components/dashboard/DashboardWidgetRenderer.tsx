"use client";

import React from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { RevenueVelocityWidget } from "./widgets/RevenueVelocityWidget";
import { FloorOccupancyWidget } from "./widgets/FloorOccupancyWidget";
import {
  OrdersTotalVolumeWidget,
  OrdersLiveFeedWidget,
  OrdersByStatusWidget,
  OrdersHighValueWidget,
  OrdersDelayedAlertsWidget,
  OrdersVolumeOverTimeWidget,
} from "./widgets/OrdersWidgets";
import {
  OverviewAovWidget,
  OverviewActiveOrdersWidget,
  OverviewPendingOrdersWidget,
  OverviewBusinessSummaryWidget,
} from "./widgets/OverviewWidgets";
import {
  KdsLiveOrdersWidget,
  KdsPendingTicketsWidget,
  KdsStationQueueWidget,
  KdsStatusBreakdownWidget,
  KdsAvgPrepTimeWidget,
  KdsDelayAlertsWidget,
} from "./widgets/KdsWidgets";
import {
  WorkstationOrderSummaryWidget,
  WorkstationOrdersByWorkstationWidget,
  WorkstationActiveTasksWidget,
  WorkstationQueueWidget,
  WorkstationPrepTimeWidget,
  WorkstationDelayedOrdersWidget,
  WorkstationPerformanceWidget,
  WorkstationAvailabilityWidget,
} from "./widgets/WorkstationWidgets";
import {
  CaptainActiveOrdersWidget,
  CaptainTableServiceStatusWidget,
  CaptainAssignedTablesWidget,
  CaptainServiceTimeWidget,
  CaptainOrdersAwaitingServiceWidget,
  CaptainPerformanceSummaryWidget,
  CaptainOrderActivityWidget,
} from "./widgets/CaptainWidgets";
import {
  MenuTopSellingWidget,
  MenuMostOrderedCategoriesWidget,
  MenuBestsellingItemsWidget,
  MenuLowPerformingWidget,
  MenuProductAvailabilityWidget,
  MenuOutOfStockAlertsWidget,
  MenuModifierPopularityWidget,
  MenuPerformanceSummaryWidget,
} from "./widgets/MenuWidgets";
import {
  CashierShiftSummaryWidget,
  CashierTotalTransactionsWidget,
  CashierCashSalesWidget,
  CashierDigitalSalesWidget,
  CashierPaymentBreakdownWidget,
  CashierRefundSummaryWidget,
  CashierTransactionHistoryWidget,
  CashierOpenSessionsWidget,
} from "./widgets/CashierWidgets";
import {
  QueueLengthWidget,
  QueueWaitingCustomersWidget,
  QueueAvgWaitTimeWidget,
  QueueRecentCalloutsWidget,
  QueueStatusBreakdownWidget,
  QueueWaitTimeAlertsWidget,
} from "./widgets/QueueWidgets";
import {
  CustomerTotalWidget,
  CustomerNewWidget,
  CustomerReturningWidget,
  CustomerRecentWidget,
  CustomerMostFrequentWidget,
  CustomerOrderFrequencyWidget,
} from "./widgets/CustomerWidgets";
import {
  SurveyResponseCountWidget,
  SurveyAverageRatingWidget,
  SurveyRecentFeedbackWidget,
  SurveySatisfactionTrendWidget,
  SurveyLowRatingAlertsWidget,
  SurveyResponseRateWidget,
} from "./widgets/SurveyWidgets";
import { GenericWidget } from "./widgets/GenericWidget";

interface Props {
  organizationId: Id<"organizations">;
  widgetId: string;
  width: number;
  dateRangePreset?: any;
  fromTimestamp?: number;
  toTimestamp?: number;
  dateLabel?: string;
}

export function DashboardWidgetRenderer({
  organizationId,
  widgetId,
  width,
  dateRangePreset,
  fromTimestamp,
  toTimestamp,
  dateLabel,
}: Props) {
  const commonProps = {
    organizationId,
    widgetId,
    width,
    dateRangePreset,
    fromTimestamp,
    toTimestamp,
    dateLabel,
  };

  switch (widgetId) {
    // Overview & Special
    case "overview_sales_trends":
    case "overview_net_revenue":
      return <RevenueVelocityWidget {...commonProps} />;
    case "overview_total_orders":
      return <OrdersTotalVolumeWidget {...commonProps} />;
    case "overview_average_order_value":
      return <OverviewAovWidget {...commonProps} />;
    case "overview_active_orders":
      return <OverviewActiveOrdersWidget {...commonProps} />;
    case "overview_pending_orders":
      return <OverviewPendingOrdersWidget {...commonProps} />;
    case "overview_order_status_distribution":
      return <OrdersByStatusWidget {...commonProps} />;
    case "overview_business_summary":
      return <OverviewBusinessSummaryWidget {...commonProps} />;
    case "orders_dinein_occupancy":
      return <FloorOccupancyWidget {...commonProps} />;

    // Orders Widgets (6)
    case "orders_total_volume":
    case "orders_channel_breakdown":
      return <OrdersTotalVolumeWidget {...commonProps} widgetId="orders_total_volume" />;
    case "orders_live_feed":
      return <OrdersLiveFeedWidget {...commonProps} widgetId="orders_live_feed" />;
    case "orders_by_status":
    case "orders_status_distribution":
      return <OrdersByStatusWidget {...commonProps} widgetId="orders_by_status" />;
    case "orders_high_value":
    case "orders_high_value_ledger":
      return <OrdersHighValueWidget {...commonProps} widgetId="orders_high_value" />;
    case "orders_delayed_alerts":
    case "kds_delayed_orders_alert":
      return <OrdersDelayedAlertsWidget {...commonProps} widgetId="orders_delayed_alerts" />;
    case "orders_volume_over_time":
    case "reports_hourly_velocity":
      return <OrdersVolumeOverTimeWidget {...commonProps} widgetId="orders_volume_over_time" />;

    // KDS Widgets (6)
    case "kds_live_orders":
      return <KdsLiveOrdersWidget {...commonProps} />;
    case "kds_pending_tickets":
      return <KdsPendingTicketsWidget {...commonProps} />;
    case "kds_station_queue":
      return <KdsStationQueueWidget {...commonProps} />;
    case "kds_status_breakdown":
      return <KdsStatusBreakdownWidget {...commonProps} />;
    case "kds_avg_prep_time":
      return <KdsAvgPrepTimeWidget {...commonProps} />;
    case "kds_delay_alerts":
      return <KdsDelayAlertsWidget {...commonProps} />;

    // Workstation Widgets (8)
    case "workstation_order_summary":
      return <WorkstationOrderSummaryWidget {...commonProps} />;
    case "workstation_orders_by_workstation":
      return <WorkstationOrdersByWorkstationWidget {...commonProps} />;
    case "workstation_active_tasks":
      return <WorkstationActiveTasksWidget {...commonProps} />;
    case "workstation_queue":
      return <WorkstationQueueWidget {...commonProps} />;
    case "workstation_prep_time":
      return <WorkstationPrepTimeWidget {...commonProps} />;
    case "workstation_delayed_orders":
      return <WorkstationDelayedOrdersWidget {...commonProps} />;
    case "workstation_performance":
      return <WorkstationPerformanceWidget {...commonProps} />;
    case "workstation_availability":
    case "workstation_terminal_health":
      return <WorkstationAvailabilityWidget {...commonProps} />;

    // Captain Widgets (7)
    case "captain_active_orders":
      return <CaptainActiveOrdersWidget {...commonProps} />;
    case "captain_table_service_status":
      return <CaptainTableServiceStatusWidget {...commonProps} />;
    case "captain_assigned_tables":
      return <CaptainAssignedTablesWidget {...commonProps} />;
    case "captain_service_time":
      return <CaptainServiceTimeWidget {...commonProps} />;
    case "captain_orders_awaiting_service":
      return <CaptainOrdersAwaitingServiceWidget {...commonProps} />;
    case "captain_performance_summary":
      return <CaptainPerformanceSummaryWidget {...commonProps} />;
    case "captain_order_activity":
      return <CaptainOrderActivityWidget {...commonProps} />;

    // Menu Widgets (8)
    case "menu_top_selling":
      return <MenuTopSellingWidget {...commonProps} />;
    case "menu_most_ordered_categories":
      return <MenuMostOrderedCategoriesWidget {...commonProps} />;
    case "menu_bestselling_items":
      return <MenuBestsellingItemsWidget {...commonProps} />;
    case "menu_low_performing":
      return <MenuLowPerformingWidget {...commonProps} />;
    case "menu_product_availability":
      return <MenuProductAvailabilityWidget {...commonProps} />;
    case "menu_out_of_stock_alerts":
      return <MenuOutOfStockAlertsWidget {...commonProps} />;
    case "menu_modifier_popularity":
      return <MenuModifierPopularityWidget {...commonProps} />;
    case "menu_performance_summary":
      return <MenuPerformanceSummaryWidget {...commonProps} />;

    // Cashier Widgets (8)
    case "cashier_shift_summary":
      return <CashierShiftSummaryWidget {...commonProps} />;
    case "cashier_total_transactions":
      return <CashierTotalTransactionsWidget {...commonProps} />;
    case "cashier_cash_sales":
      return <CashierCashSalesWidget {...commonProps} />;
    case "cashier_digital_sales":
      return <CashierDigitalSalesWidget {...commonProps} />;
    case "cashier_payment_breakdown":
      return <CashierPaymentBreakdownWidget {...commonProps} />;
    case "cashier_refund_summary":
      return <CashierRefundSummaryWidget {...commonProps} />;
    case "cashier_transaction_history":
      return <CashierTransactionHistoryWidget {...commonProps} />;
    case "cashier_open_sessions":
      return <CashierOpenSessionsWidget {...commonProps} />;

    // Queue Widgets (6)
    case "queue_length":
      return <QueueLengthWidget {...commonProps} />;
    case "queue_waiting_customers":
      return <QueueWaitingCustomersWidget {...commonProps} />;
    case "queue_avg_wait_time":
      return <QueueAvgWaitTimeWidget {...commonProps} />;
    case "queue_recent_callouts":
      return <QueueRecentCalloutsWidget {...commonProps} />;
    case "queue_status_breakdown":
      return <QueueStatusBreakdownWidget {...commonProps} />;
    case "queue_wait_time_alerts":
      return <QueueWaitTimeAlertsWidget {...commonProps} />;

    // Customers Widgets (6)
    case "customers_total":
      return <CustomerTotalWidget {...commonProps} />;
    case "customers_new":
      return <CustomerNewWidget {...commonProps} />;
    case "customers_returning":
      return <CustomerReturningWidget {...commonProps} />;
    case "customers_recent":
      return <CustomerRecentWidget {...commonProps} />;
    case "customers_frequent":
    case "customers_most_frequent":
      return <CustomerMostFrequentWidget {...commonProps} />;
    case "customers_order_frequency":
      return <CustomerOrderFrequencyWidget {...commonProps} />;

    // Surveys Widgets (6)
    case "surveys_response_count":
    case "surveys_response_counts":
      return <SurveyResponseCountWidget {...commonProps} />;
    case "surveys_average_rating":
      return <SurveyAverageRatingWidget {...commonProps} />;
    case "surveys_recent_feedback":
      return <SurveyRecentFeedbackWidget {...commonProps} />;
    case "surveys_satisfaction_trend":
    case "surveys_satisfaction_trends":
      return <SurveySatisfactionTrendWidget {...commonProps} />;
    case "surveys_low_rating_alerts":
      return <SurveyLowRatingAlertsWidget {...commonProps} />;
    case "surveys_response_rate":
    case "surveys_response_rates":
      return <SurveyResponseRateWidget {...commonProps} />;

    default:
      return <GenericWidget {...commonProps} />;
  }
}
