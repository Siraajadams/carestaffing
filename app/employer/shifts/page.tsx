alter table public.shifts enable row level security;

drop policy if exists "Employers can create shifts" on public.shifts;
drop policy if exists "Employers can view own shifts" on public.shifts;
drop policy if exists "Employers can update own shifts" on public.shifts;
drop policy if exists "Professionals can view open shifts" on public.shifts;

create policy "Employers can create shifts"
on public.shifts
for insert
to authenticated
with check (
  created_by = auth.uid()
);

create policy "Employers can view own shifts"
on public.shifts
for select
to authenticated
using (
  created_by = auth.uid()
);

create policy "Employers can update own shifts"
on public.shifts
for update
to authenticated
using (
  created_by = auth.uid()
)
with check (
  created_by = auth.uid()
);

create policy "Professionals can view open shifts"
on public.shifts
for select
to authenticated
using (
  status = 'open'
  OR created_by = auth.uid()
);
