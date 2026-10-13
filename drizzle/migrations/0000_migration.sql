
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.courses to authenticated;
grant all on public.courses to service_role;
alter table public.courses enable row level security;
create policy "own courses" on public.courses for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  kind text not null,
  mime text,
  status text not null default 'uploading',
  error text,
  storage_path text,
  unit_count int not null default 0,
  figure_count int not null default 0,
  summary text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;
create policy "own documents" on public.documents for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  parent_id uuid references public.topics(id) on delete set null,
  prerequisites text[] not null default '{}',
  description text,
  created_at timestamptz not null default now(),
  unique (course_id, name)
);
grant select, insert, update, delete on public.topics to authenticated;
grant all on public.topics to service_role;
alter table public.topics enable row level security;
create policy "own topics" on public.topics for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  seq int not null default 0,
  kind text not null default 'text',
  content text not null,
  page int,
  slide int,
  ts_start numeric,
  ts_end numeric,
  tsv tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now()
);
create index chunks_tsv_idx on public.chunks using gin (tsv);
create index chunks_doc_idx on public.chunks (document_id, seq);
grant select, insert, update, delete on public.chunks to authenticated;
grant all on public.chunks to service_role;
alter table public.chunks enable row level security;
create policy "own chunks" on public.chunks for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.mastery (
  user_id uuid not null default auth.uid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  p_mastery double precision not null default 0.3,
  attempts int not null default 0,
  correct int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);
grant select, insert, update, delete on public.mastery to authenticated;
grant all on public.mastery to service_role;
alter table public.mastery enable row level security;
create policy "own mastery" on public.mastery for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.mastery_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  p_before double precision not null,
  p_after double precision not null,
  correct boolean not null,
  difficulty text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.mastery_events to authenticated;
grant all on public.mastery_events to service_role;
alter table public.mastery_events enable row level security;
create policy "own mastery events" on public.mastery_events for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  chunk_id uuid references public.chunks(id) on delete set null,
  difficulty text not null,
  stem text not null,
  options jsonb not null,
  correct_index int not null,
  explanation text not null,
  evidence text not null,
  verified boolean not null default false,
  verification_note text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.questions to authenticated;
grant all on public.questions to service_role;
alter table public.questions enable row level security;
create policy "own questions" on public.questions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  difficulty text not null,
  is_diagnostic boolean not null default false,
  question_ids uuid[] not null default '{}',
  generation_note text,
  score int not null default 0,
  total int not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.quizzes to authenticated;
grant all on public.quizzes to service_role;
alter table public.quizzes enable row level security;
create policy "own quizzes" on public.quizzes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_index int not null,
  correct boolean not null,
  created_at timestamptz not null default now(),
  unique (quiz_id, question_id)
);
grant select, insert, update, delete on public.attempts to authenticated;
grant all on public.attempts to service_role;
alter table public.attempts enable row level security;
create policy "own attempts" on public.attempts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null default 'New conversation',
  course_id uuid references public.courses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.threads to authenticated;
grant all on public.threads to service_role;
alter table public.threads enable row level security;
create policy "own threads" on public.threads for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  msg_id text not null,
  role text not null,
  parts jsonb not null,
  created_at timestamptz not null default now(),
  unique (thread_id, msg_id)
);
grant select, insert, update, delete on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "own messages" on public.messages for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.eval_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  kind text not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.eval_runs to authenticated;
grant all on public.eval_runs to service_role;
alter table public.eval_runs enable row level security;
create policy "own eval runs" on public.eval_runs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.search_chunks(q text, p_course uuid default null, p_topic uuid default null, k int default 6)
returns table (id uuid, document_id uuid, document_name text, content text, page int, slide int, ts_start numeric, ts_end numeric, kind text, topic_id uuid, rank real)
language sql stable security invoker set search_path = public as $$
  with terms as (
    select string_agg(distinct lexeme, ' | ') as tq
    from unnest(to_tsvector('english', q)) as t(lexeme, positions, weights)
  )
  select c.id, c.document_id, d.name, c.content, c.page, c.slide, c.ts_start, c.ts_end, c.kind, c.topic_id,
         ts_rank_cd(c.tsv, to_tsquery('english', terms.tq)) as rank
  from public.chunks c
  join public.documents d on d.id = c.document_id
  cross join terms
  where terms.tq is not null
    and c.tsv @@ to_tsquery('english', terms.tq)
    and (p_course is null or c.course_id = p_course)
    and (p_topic is null or c.topic_id = p_topic)
    and d.status = 'ready'
  order by rank desc
  limit k;
$$;
grant execute on function public.search_chunks(text, uuid, uuid, int) to authenticated;
