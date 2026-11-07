// תמונות (שוברים, רכבים): כיווץ במכשיר (תמונת אייפון של 4MB -> כ-300KB) והעלאה לבאקט פרטי
import { supabase } from "./supabase";

const BUCKET = "vouchers";

export async function compressImage(file, max = 1600, quality = 0.85) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality));
}

export async function uploadImage(prefix, file) {
  const blob = await compressImage(file);
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

export async function removeImage(path) {
  const paths = [path].flat().filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}

const urls = new Map();
export async function imageUrl(path) {
  if (!path) return null;
  const hit = urls.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  urls.set(path, { url: data.signedUrl, expires: Date.now() + 3500_000 });
  return data.signedUrl;
}
