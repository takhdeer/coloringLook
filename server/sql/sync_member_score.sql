-- Keeps public.group_members.score (what the leaderboard shows) equal to the sum of that player's
-- public.user_colors scores in the group, whatever changes user_colors: /api/score, or an edit in
-- the Supabase table editor.
--
-- Not applied automatically. Run it once in the Supabase SQL editor. Safe to run again.
-- /api/score still sets group_members.score itself too; with this trigger in place that's the
-- same value written twice, so it can be dropped from score.js later.

begin;

create or replace function public.sync_member_score() returns trigger
language plpgsql as $$
declare
    g uuid;
    u uuid;
begin
    if tg_op = 'DELETE' then
        g := old.group_id;
        u := old.user_id;
    else
        g := new.group_id;
        u := new.user_id;
    end if;

    update public.group_members
    set score = (select coalesce(sum(score), 0)::int
                 from public.user_colors
                 where group_id = g and user_id = u)
    where group_id = g and user_id = u;

    -- A row moved to another player or group: bring the old one up to date as well
    if tg_op = 'UPDATE' and (old.group_id, old.user_id) is distinct from (new.group_id, new.user_id) then
        update public.group_members
        set score = (select coalesce(sum(score), 0)::int
                     from public.user_colors
                     where group_id = old.group_id and user_id = old.user_id)
        where group_id = old.group_id and user_id = old.user_id;
    end if;

    return null;
end $$;

drop trigger if exists user_colors_sync_member_score on public.user_colors;
create trigger user_colors_sync_member_score
after insert or update or delete on public.user_colors
for each row execute function public.sync_member_score();

-- One-off: bring every member's score in line with their colour scores now.
-- Members whose colour scores are all 0 (e.g. after a hand edit) go back to 0.
update public.group_members gm
set score = coalesce((select sum(uc.score)::int
                      from public.user_colors uc
                      where uc.group_id = gm.group_id and uc.user_id = gm.user_id), 0)
where gm.score is distinct from coalesce((select sum(uc.score)::int
                                          from public.user_colors uc
                                          where uc.group_id = gm.group_id and uc.user_id = gm.user_id), 0);

commit;
