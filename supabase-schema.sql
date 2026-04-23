create table if not exists public.leads (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  handle text not null,
  stage text not null check (stage in ('dm_sent', 'responded', 'qualified', 'booked', 'showed', 'closed_won', 'closed_lost')),
  source text not null check (source in ('instagram_outbound', 'instagram_inbound', 'story_reply', 'referral', 'other')),
  amount numeric not null default 0,
  objection text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads enable row level security;

do $$ begin
  create policy "users_can_select_own_leads" on public.leads
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users_can_insert_own_leads" on public.leads
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users_can_update_own_leads" on public.leads
    for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users_can_delete_own_leads" on public.leads
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
