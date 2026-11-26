import { redirect } from "next/navigation";

export default async function OrdersPage() {
  // Redirect to new Trade page
  redirect("/trade");
}