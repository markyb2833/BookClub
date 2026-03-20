import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { imageExtFromMagic } from "@/lib/uploads/imageMagic";
import { storeUploadedImage } from "@/lib/uploads/storeImage";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 5MB)" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = imageExtFromMagic(new Uint8Array(buf));
  if (!ext) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  const url = await storeUploadedImage(buf, ext);
  return NextResponse.json({ url });
}
