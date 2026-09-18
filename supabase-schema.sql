-- 자금 학생회 온라인 집무실 · Supabase 스키마 v1
create table if not exists profiles (id uuid primary key references auth.users(id) on delete cascade, login_id text unique not null, name text not null, role text not null default 'general_student', status text not null default 'pending', team_id text, dept_id text, created_at timestamptz default now());
create table if not exists departments (id text primary key, name text not null);
create table if not exists teams (id text primary key, dept_id text references departments(id), name text not null);
insert into departments (id,name) values ('plan','기획부'),('promo','홍보부'),('manage','진행부') on conflict (id) do nothing;
insert into teams (id,dept_id,name) values ('event-plan','plan','행사기획팀'),('suggest-plan','plan','건의사항관리기획팀'),('policy-promo','promo','공익/정책홍보팀'),('event-promo','promo','행사홍보팀'),('general-run','manage','일반진행부'),('safety-run','manage','안전진행부') on conflict (id) do nothing;
create table if not exists notices (id uuid primary key default gen_random_uuid(),title text not null,body text default '',pinned boolean default false,target text default '전체',writer_id uuid references profiles(id),writer_name text,read_by text[] default '{}',created_at timestamptz default now());
create table if not exists events (id uuid primary key default gen_random_uuid(),title text not null,event_date text not null,place text default '',dept text default '',writer_name text,created_at timestamptz default now());
create table if not exists documents (id uuid primary key default gen_random_uuid(),title text not null,category text default '기타',visibility text default '임원공개',uploader_id uuid references profiles(id),uploader_name text,team_id text,dept_id text,step text default 'draft',file_name text,file_path text,created_at timestamptz default now());
create table if not exists doc_history (id uuid primary key default gen_random_uuid(),document_id uuid references documents(id) on delete cascade,who text,action text,created_at timestamptz default now());
create table if not exists chat_rooms (key text primary key,name text not null);
insert into chat_rooms(key,name) values ('executives','임원회의실'),('all','전체광장') on conflict (key) do nothing;
create table if not exists chat_messages (id uuid primary key default gen_random_uuid(),room_key text references chat_rooms(key) on delete cascade,sender_id uuid references profiles(id),sender_name text,sender_role text,content text,created_at timestamptz default now());
create table if not exists suggestions (id uuid primary key default gen_random_uuid(),title text not null,body text not null,category text default '기타',is_anonymous boolean default false,visibility text default '전체공개',status text default '접수',writer_id uuid references profiles(id),writer_name text,answer text default '',answered_by text default '',created_at timestamptz default now());
create table if not exists suggestion_likes (suggestion_id uuid references suggestions(id) on delete cascade,user_id uuid references profiles(id) on delete cascade,primary key(suggestion_id,user_id));
create table if not exists audit_logs (id uuid primary key default gen_random_uuid(),actor text,action text,created_at timestamptz default now());
insert into storage.buckets(id,name,public) values ('documents','documents',false) on conflict(id) do nothing;
