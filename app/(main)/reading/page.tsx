import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ReadingCalendarClient from "@/components/reading/ReadingCalendarClient";

export const metadata = { title: "Reading" };

export default async function ReadingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return <ReadingCalendarClient />;
}
