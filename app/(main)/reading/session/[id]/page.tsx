import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ReadingSessionPageClient from "@/components/reading/ReadingSessionPageClient";

export const metadata = { title: "Read log" };

export default async function ReadingSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  return <ReadingSessionPageClient sessionId={id} />;
}
