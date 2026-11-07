// אירוע יומן (.ics) לטסט: יום שלם בתאריך הטסט + התראה שבוע לפני ב-09:00. האייפון פותח אותו כ"הוספה ליומן"
export function buildIcs({ title, date, uid }) {
  const day = date.replace(/-/g, "");
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = next.toISOString().slice(0, 10).replace(/-/g, "");
  const esc = (s) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, " ");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HomeSync//Cars//HE",
    "BEGIN:VEVENT",
    `UID:${uid}@homesync`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${esc(title)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(title)} בעוד שבוע`,
    "TRIGGER:-P6DT15H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export default function handler(req, res) {
  const date = String(req.query.date || "");
  const title = String(req.query.title || "טסט לרכב").slice(0, 120);
  const uid = String(req.query.uid || date).replace(/[^\w-]/g, "").slice(0, 80);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).send("bad date");
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'inline; filename="test.ics"');
  res.send(buildIcs({ title, date, uid }));
}
