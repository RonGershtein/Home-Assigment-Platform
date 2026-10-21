// תצוגה מקדימה ללינק מתכון: שולף כותרת ותמונה (og:title / og:image) מהדף
export default async function handler(req, res) {
  const url = String(req.query.url || "");
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: "bad url" });
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1", "accept-language": "he,en;q=0.8" },
    });
    clearTimeout(t);
    const html = (await r.text()).slice(0, 400_000);
    const meta = (prop) => {
      const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, "i");
      const tag = html.match(re)?.[0];
      return tag?.match(/content=["']([^"']*)["']/i)?.[1];
    };
    const decode = (s) => s?.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
    let image = decode(meta("og:image") || meta("twitter:image"));
    if (image && !/^https?:/i.test(image)) image = new URL(image, r.url).href;
    const title = decode(meta("og:title") || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]);
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
    res.json({ title: title || null, image: image || null, site: new URL(r.url).hostname.replace(/^www\./, "") });
  } catch {
    res.status(502).json({ error: "fetch failed" });
  }
}
