import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/** https://developers.giphy.com/docs/api/endpoint/#search */
type GiphyImageSet = {
  preview_gif?: { url?: string };
  fixed_height_small?: { url?: string };
  original?: { url?: string };
};

type GiphyItem = {
  id: string;
  images?: GiphyImageSet;
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.GIPHY_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({ results: [], disabled: true });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() || "book";
  const url = new URL("https://api.giphy.com/v1/gifs/search");
  url.searchParams.set("api_key", key);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "24");
  url.searchParams.set("rating", "pg-13");
  url.searchParams.set("lang", "en");

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) {
    return NextResponse.json({ results: [], error: "Giphy request failed" }, { status: 502 });
  }

  const data = (await res.json()) as { data?: GiphyItem[] };
  const results = (data.data ?? [])
    .map((item) => {
      const gifUrl = item.images?.original?.url ?? "";
      const previewUrl =
        item.images?.preview_gif?.url ??
        item.images?.fixed_height_small?.url ??
        gifUrl;
      if (!gifUrl) return null;
      return {
        id: item.id,
        previewUrl,
        url: gifUrl,
      };
    })
    .filter((x): x is { id: string; previewUrl: string; url: string } => x !== null);

  return NextResponse.json({ results });
}
