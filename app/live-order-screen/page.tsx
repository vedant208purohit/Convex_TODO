import { Metadata } from "next";
import { OrganizationLiveScreens } from "../components/OrganizationLiveScreens";

export const metadata: Metadata = {
  title: "Live Order Screen | POS",
  description: "Real-time kitchen and cashier live order monitoring screen",
};

export default function LiveOrderScreenPage() {
  return <OrganizationLiveScreens standalone={true} />;
}
