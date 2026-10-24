import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Page, BackButton } from "../components/Shell";
import ThemeToggle from "../components/ThemeToggle";
import { Segmented, Skeletons } from "../components/ui";
import { useTable } from "../hooks/useTable";
import WeightTab from "./nutrition/WeightTab";
import FoodTab from "./nutrition/FoodTab";
import BodyTab from "./nutrition/BodyTab";

const TABS = [
  { value: "weight", label: "משקל" },
  { value: "food", label: "אוכל" },
  { value: "body", label: "הגוף שלי" },
];

// תזונה: מעקב משקל של שנינו, יומן אוכל יומי, ו-BMI / BMR / יעד קלוריות.
// הטאב נשמר ב-URL (?tab=) כדי שהתראות יפתחו ישר את המסך הנכון.
export default function Nutrition({ user }) {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get("tab")) ? params.get("tab") : "weight";
  const setTab = (v) => setParams(v === "weight" ? {} : { tab: v }, { replace: true });

  const me = user?.id ?? "demo";
  const weights = useTable("weight_entries");
  const foods = useTable("food_entries");
  const profiles = useTable("nutrition_profiles");
  const people = useTable("profiles");

  const myProfile = useMemo(() => profiles.rows.find((p) => p.user_id === me) ?? null, [profiles.rows, me]);
  const names = useMemo(() => new Map(people.rows.map((p) => [p.user_id, p.name])), [people.rows]);
  const nameOf = (uid) => names.get(uid) || (uid === me ? "אני" : "בן/בת הזוג");
  const myName = names.get(me) || "אני";

  const saveProfile = async (patch) => {
    await profiles.api.upsert({ user_id: me, ...patch }, "user_id");
    await profiles.refresh();
  };

  const ctx = { me, myName, nameOf, weights, foods, myProfile, profiles, saveProfile };

  return (
    <Page title="תזונה" back={<BackButton fallback={{ to: "/more", label: "עוד" }} />} action={<ThemeToggle />}>
      <Segmented value={tab} onChange={setTab} options={TABS} className="mb-4" />
      {tab === "weight" && <WeightTab {...ctx} />}
      {tab === "food" && <FoodTab {...ctx} goBody={() => setTab("body")} />}
      {tab === "body" && (profiles.loading ? <Skeletons n={2} h={160} /> : <BodyTab key={myProfile?.updated_at ?? "new"} {...ctx} />)}
    </Page>
  );
}
