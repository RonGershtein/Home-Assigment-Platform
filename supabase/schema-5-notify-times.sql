-- הוחל דרך Supabase MCP ב-2026-11-07.
-- שעות התראה לבחירה: שקילה ויומן אוכל נשלחים בשעה שכל מכשיר בחר (prefs.weight_time / prefs.food_time),
-- אז notify-evening רץ כל רבע שעה במקום פעם בערב. notify_log מונע כפילויות.
select cron.alter_job((select jobid from cron.job where jobname = 'notify-evening'), schedule := '*/15 * * * *');
