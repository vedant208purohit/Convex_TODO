import { redirect } from "next/navigation";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === "string" && value) {
      params.set(key, value);
    } else if (Array.isArray(value) && value.length > 0 && value[0]) {
      params.set(key, value[0]);
    }
  }

  const query = params.toString();
  redirect(query ? `/dashboard?${query}` : "/dashboard");
}
