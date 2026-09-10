import { Doc, Id } from "@/convex/_generated/dataModel";

export type OrderProcessDoc = Doc<"organizationOrderProcesses">;
export type OrderProcessId = Id<"organizationOrderProcesses">;

export interface OrderProcessFormData {
  id?: OrderProcessId;
  name: string;
  processColor: string;
  description?: string;
  published: boolean;
  isSequence?: boolean;
}

export interface DrawerState {
  isOpen: boolean;
  mode: "create" | "edit";
  process?: OrderProcessDoc | null;
}

export const REFERENCE_ORDER_PROCESSES: OrderProcessDoc[] = [
  {
    _id: "ref_proc_1" as OrderProcessId,
    _creationTime: Date.now() - 4000,
    name: "Accepted",
    description: "Initial order acceptance",
    position: 1,
    published: true,
    isSequence: true,
    processColor: "#262626",
    createdAt: Date.now() - 4000,
    updatedAt: Date.now() - 4000,
  },
  {
    _id: "ref_proc_2" as OrderProcessId,
    _creationTime: Date.now() - 3000,
    name: "In progress",
    description: "Kitchen preparation",
    position: 2,
    published: true,
    isSequence: true,
    processColor: "#EA9C1B",
    createdAt: Date.now() - 3000,
    updatedAt: Date.now() - 3000,
  },
  {
    _id: "ref_proc_3" as OrderProcessId,
    _creationTime: Date.now() - 2000,
    name: "Ready to deliver",
    description: "Ready for handoff",
    position: 3,
    published: true,
    isSequence: true,
    processColor: "#FC8019",
    createdAt: Date.now() - 2000,
    updatedAt: Date.now() - 2000,
  },
  {
    _id: "ref_proc_4" as OrderProcessId,
    _creationTime: Date.now() - 1000,
    name: "Delivered",
    description: "Order completed",
    position: 4,
    published: true,
    isSequence: true,
    processColor: "#219653",
    createdAt: Date.now() - 1000,
    updatedAt: Date.now() - 1000,
  },
];
