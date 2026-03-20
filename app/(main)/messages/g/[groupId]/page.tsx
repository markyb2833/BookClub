import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import MessagesGroupThread from "@/components/social/MessagesGroupThread";

interface Props {
  params: Promise<{ groupId: string }>;
}

export default async function GroupMessageThreadPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { groupId } = await params;
  return <MessagesGroupThread groupId={groupId} myUserId={session.user.id} />;
}
