const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface Asset {
  id: string;
  path: string;
  filename: string;
  media_type: "image" | "video";
  width: number | null;
  height: number | null;
  duration: number | null;
  file_size: number;
  created_at: string;
  updated_at: string;
}

export interface AssetListResponse {
  assets: Asset[];
  total: number;
}

export async function fetchAssets(params?: {
  media_type?: string;
  search?: string;
}): Promise<AssetListResponse> {
  const url = new URL(`${API_BASE}/assets`);
  if (params?.media_type) url.searchParams.set("media_type", params.media_type);
  if (params?.search) url.searchParams.set("search", params.search);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch assets: ${res.status}`);
  return res.json();
}

export async function fetchAsset(id: string): Promise<Asset> {
  const res = await fetch(`${API_BASE}/assets/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch asset: ${res.status}`);
  return res.json();
}

export async function indexDirectory(directory: string) {
  const res = await fetch(`${API_BASE}/assets/index-directory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ directory }),
  });
  if (!res.ok) throw new Error(`Failed to index directory: ${res.status}`);
  return res.json();
}
