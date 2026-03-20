import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const PROJECTS_BASE = process.env.PROJECTS_BASE || path.join(process.cwd(), "projects");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  const { subdomain } = await params;

  if (!/^[a-z0-9-]+$/i.test(subdomain)) {
    return NextResponse.json({ error: "Invalid subdomain" }, { status: 400 });
  }

  const dir = path.join(PROJECTS_BASE, subdomain);

  const [html, css, js] = await Promise.all([
    fs.readFile(path.join(dir, "index.html"), "utf8").catch(() => null),
    fs.readFile(path.join(dir, "styles.css"), "utf8").catch(() => null),
    fs.readFile(path.join(dir, "script.js"), "utf8").catch(() => null),
  ]);

  if (!html) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  return NextResponse.json({ html, css, js });
}
