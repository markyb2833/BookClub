import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import MessagesThread from "@/components/social/MessagesThread";

interface Props {
  params: Promise<{ username: string }>;
}

export default async function MessageThreadPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { username } = await params;
  return <MessagesThread username={username} myUserId={session.user.id} />;
}
