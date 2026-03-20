import type { Metadata } from "next";
import FeedClient from "@/components/social/FeedClient";

export const metadata: Metadata = {
  title: "Feed",
};

export default function FeedPage() {
  return <FeedClient />;
}
