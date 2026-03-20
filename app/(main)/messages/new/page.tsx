import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import NewGroupChatForm from "@/components/social/NewGroupChatForm";

export const metadata = { title: "New group" };

export default async function NewGroupChatPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <NewGroupChatForm />;
}
