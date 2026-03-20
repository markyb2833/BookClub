import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import MessagesInbox from "@/components/social/MessagesInbox";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <MessagesInbox />;
}
