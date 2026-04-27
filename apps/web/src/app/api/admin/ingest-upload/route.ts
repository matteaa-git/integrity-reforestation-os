import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const INBOX_ROOT = "/Users/matthewmckernan/Integrity_AssetLibrary/INBOX";

const ALLOWED_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".heic", ".avif", ".gif",
  ".mp4", ".mov", ".m4v", ".avi", ".mkv",
  ".pdf", ".xlsx", ".xls", ".csv", ".docx", ".doc", ".txt",
]);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const subdir = (formData.get("subdir") as string | null) ?? "";

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const destDir = subdir
      ? path.join(INBOX_ROOT, subdir.replace(/\.\./g, "")) // prevent path traversal
      : INBOX_ROOT;

    await mkdir(destDir, { recursive: true });

    const saved: { name: string; path: string; size_kb: number }[] = [];
    const errors: { name: string; error: string }[] = [];

    for (const file of files) {
      const originalName = path.basename(file.name || "upload");
      const ext = path.extname(originalName).toLowerCase();

      if (!ALLOWED_EXTS.has(ext)) {
        errors.push({ name: originalName, error: `Unsupported type: ${ext}` });
        continue;
      }

      // Avoid overwriting existing files
      let destPath = path.join(destDir, originalName);
      if (existsSync(destPath)) {
        const stem = path.basename(originalName, ext);
        let i = 1;
        while (existsSync(destPath)) {
          destPath = path.join(destDir, `${stem}_${i}${ext}`);
          i++;
        }
      }

      try {
        const bytes = await file.arrayBuffer();
        await writeFile(destPath, Buffer.from(bytes));
        saved.push({
          name: path.basename(destPath),
          path: destPath,
          size_kb: Math.round(bytes.byteLength / 1024),
        });
      } catch (err: unknown) {
        errors.push({ name: originalName, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return NextResponse.json({ saved, errors, count: saved.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
