alter table public.shift_applications
enable row level security;

drop policy if exists "Workers can apply for shifts"
on public.shift_applications;

drop policy if exists "Workers can view own applications"
on public.shift_applications;

drop policy if exists "Employers can view shift applicants"
on public.shift_applications;

drop policy if exists "Employers can update applications"
on public.shift_applications;

create policy "Workers can apply for shifts"
on public.shift_applications
for insert
to authenticated
with check (
  applicant_id = auth.uid()
);

create policy "Workers can view own applications"
on public.shift_applications
for select
to authenticated
using (
  applicant_id = auth.uid()
);

create policy "Employers can view shift applicants"
on public.shift_applications
for select
to authenticated
using (
  exists (
    select 1
    from public.shifts
    where public.shifts.id =
      public.shift_applications.shift_id
    and public.shifts.created_by = auth.uid()
  )
);

create policy "Employers can update applications"
on public.shift_applications
for update
to authenticated
using (
  exists (
    select 1
    from public.shifts
    where public.shifts.id =
      public.shift_applications.shift_id
    and public.shifts.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.shifts
    where public.shifts.id =
      public.shift_applications.shift_id
    and public.shifts.created_by = auth.uid()
  )
);
