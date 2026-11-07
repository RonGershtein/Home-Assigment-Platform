import { Page } from "../components/Shell";
import { NotificationSettings } from "../components/Settings";
import { isDemoMode } from "../lib/supabase";
import { BackLink } from "./Vouchers";

export default function Notifications() {
  return (
    <Page title="התראות" back={<BackLink />}>
      {isDemoMode ? <p className="card p-4 text-[15px] text-muted">התראות לא זמינות במצב הדגמה</p> : <NotificationSettings />}
    </Page>
  );
}
