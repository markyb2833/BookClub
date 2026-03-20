import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers and underscores"),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { username, email, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: { equals: username, mode: "insensitive" } }, { email: email.toLowerCase() }] },
  });
  if (existing) {
    const field = existing.username.toLowerCase() === username.toLowerCase() ? "Username" : "Email";
    return NextResponse.json({ error: `${field} is already taken` }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      username,
      email: email.toLowerCase(),
      passwordHash,
      settings: {
        create: {},
      },
      shelves: {
        create: [
          { name: "Want to Read", slug: "want-to-read", isDefault: true },
          { name: "Currently Reading", slug: "currently-reading", isDefault: true },
          { name: "Read", slug: "read", isDefault: true },
        ],
      },
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
