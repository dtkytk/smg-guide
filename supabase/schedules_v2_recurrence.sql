-- ============================================================
-- SMG GUIDE - schedules テーブル: 繰り返し設定の拡張(v2)
-- ------------------------------------------------------------
-- schedules.sql を実行済みであることが前提です。
-- 既存の schedules テーブルを DROP せず、ALTER TABLE で安全に拡張します。
-- posts テーブル・既存の記事データには一切影響しません。
--
-- 変更内容:
--   1. recurrence_type に 'interval'(間隔繰り返し)を追加
--      → 'weekly'(毎週) / 'interval'(N日ごと) / 'once'(単発)の3種類
--   2. day_of_week を smallint → smallint[] に変更(複数曜日を1レコードで表現)
--      例: {1,4} = 毎週 月曜日+木曜日
--   3. interval_days(整数, 例: 2 = 2日ごと)を追加
--   4. start_date(interval の起算日)を追加
--
-- 【修正】初版で発生した
--   ERROR: 42883: operator does not exist: smallint[] >= integer
-- は、schedules.sql が day_of_week 列に付与していた暗黙のCHECK制約
-- (day_of_week between 0 and 6 = smallint >= integer の比較を含む)を
-- 型変更前に削除していなかったことが原因です。本版では制約名に依存せず、
-- day_of_week 列にかかっている CHECK 制約をすべて動的に検出して削除してから
-- 型を変更し、配列に対応した新しい範囲チェック(<@ 演算子)を付け直します。
--
-- ⚠️ 実行前に、このファイル内の 'REPLACE_WITH_YOUR_PASSPHRASE'(2箇所、
--    create_schedule と update_schedule の中)を、実際に使っている合言葉に
--    置き換えてください。
-- ============================================================

-- 1. 既存のCHECK制約を削除(レコード全体の整合性チェック)
alter table public.schedules drop constraint if exists schedules_recurrence_fields_chk;

-- 2. recurrence_type のCHECK制約を更新('interval'を追加)
alter table public.schedules drop constraint if exists schedules_recurrence_type_check;
alter table public.schedules add constraint schedules_recurrence_type_check
  check (recurrence_type in ('weekly','interval','once'));

-- 3. day_of_week にかかっている既存のCHECK制約をすべて動的に削除
--    (schedules.sql 側の暗黙の "day_of_week between 0 and 6" 制約が
--     smallint 前提のため、型変更前に必ず削除する必要がある)
do $$
declare
  con record;
begin
  for con in
    select c.conname
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_attribute att
      on att.attrelid = rel.oid
     and att.attnum = any(c.conkey)
    where rel.relname = 'schedules'
      and att.attname = 'day_of_week'
      and c.contype = 'c'
  loop
    execute format('alter table public.schedules drop constraint %I', con.conname);
  end loop;
end $$;

-- 4. day_of_week を smallint[] に変換
--    (既存値があれば1要素配列に包む。今回は空テーブルのため実質NULLのみ)
alter table public.schedules
  alter column day_of_week type smallint[]
  using (case when day_of_week is null then null else array[day_of_week]::smallint[] end);

-- 5. day_of_week の配列要素がすべて 0〜6 の範囲内であることを検証する制約
--    (<@ は「左辺の配列の全要素が右辺の配列に含まれるか」を判定する演算子)
alter table public.schedules add constraint schedules_day_of_week_range_chk
  check (day_of_week is null or day_of_week <@ array[0,1,2,3,4,5,6]::smallint[]);

-- 6. 新カラムを追加
alter table public.schedules add column if not exists interval_days integer;
alter table public.schedules add column if not exists start_date date;

-- 7. 新しいCHECK制約(3パターンを排他的に検証)
alter table public.schedules add constraint schedules_recurrence_fields_chk check (
  (recurrence_type = 'weekly'
    and day_of_week is not null and array_length(day_of_week, 1) > 0
    and interval_days is null and start_date is null and specific_date is null)
  or
  (recurrence_type = 'interval'
    and interval_days is not null and interval_days > 0
    and start_date is not null
    and day_of_week is null and specific_date is null)
  or
  (recurrence_type = 'once'
    and specific_date is not null
    and day_of_week is null and interval_days is null and start_date is null)
);

-- 8. RPC関数の再作成(パラメータ構成が変わるため一度DROPしてから作り直す)
drop function if exists public.create_schedule(
  text, text, text, text, text, text, text, text, text,
  text, smallint, date, time,
  text, text, text, text, text,
  text, text, text, text, text,
  bigint, integer, boolean
);
drop function if exists public.update_schedule(
  bigint, text, text, text, text, text, text, text, text, text,
  text, smallint, date, time,
  text, text, text, text, text,
  text, text, text, text, text,
  bigint, integer, boolean
);

create or replace function public.create_schedule(
  key text,
  p_title text,
  p_title_en text default null,
  p_title_kr text default null,
  p_title_tr text default null,
  p_title_de text default null,
  p_rule_label text default null,
  p_tag_color text default 'pink',
  p_image_url text default null,
  p_recurrence_type text default 'weekly',
  p_day_of_week smallint[] default null,
  p_interval_days integer default null,
  p_start_date date default null,
  p_specific_date date default null,
  p_st_time time default null,
  p_note_text text default null,
  p_note_text_en text default null,
  p_note_text_kr text default null,
  p_note_text_tr text default null,
  p_note_text_de text default null,
  p_important_text text default null,
  p_important_text_en text default null,
  p_important_text_kr text default null,
  p_important_text_tr text default null,
  p_important_text_de text default null,
  p_link_post_id bigint default null,
  p_sort_order integer default 0,
  p_published boolean default true
) returns public.schedules
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.schedules;
begin
  if key <> 'REPLACE_WITH_YOUR_PASSPHRASE' then
    raise exception '合言葉が間違っています';
  end if;

  insert into public.schedules (
    title, title_en, title_kr, title_tr, title_de,
    rule_label, tag_color, image_url,
    recurrence_type, day_of_week, interval_days, start_date, specific_date, st_time,
    note_text, note_text_en, note_text_kr, note_text_tr, note_text_de,
    important_text, important_text_en, important_text_kr, important_text_tr, important_text_de,
    link_post_id, sort_order, published
  ) values (
    p_title, p_title_en, p_title_kr, p_title_tr, p_title_de,
    p_rule_label, p_tag_color, p_image_url,
    p_recurrence_type, p_day_of_week, p_interval_days, p_start_date, p_specific_date, p_st_time,
    p_note_text, p_note_text_en, p_note_text_kr, p_note_text_tr, p_note_text_de,
    p_important_text, p_important_text_en, p_important_text_kr, p_important_text_tr, p_important_text_de,
    p_link_post_id, p_sort_order, p_published
  )
  returning * into result;

  return result;
end;
$$;

create or replace function public.update_schedule(
  schedule_id bigint,
  key text,
  p_title text,
  p_title_en text default null,
  p_title_kr text default null,
  p_title_tr text default null,
  p_title_de text default null,
  p_rule_label text default null,
  p_tag_color text default 'pink',
  p_image_url text default null,
  p_recurrence_type text default 'weekly',
  p_day_of_week smallint[] default null,
  p_interval_days integer default null,
  p_start_date date default null,
  p_specific_date date default null,
  p_st_time time default null,
  p_note_text text default null,
  p_note_text_en text default null,
  p_note_text_kr text default null,
  p_note_text_tr text default null,
  p_note_text_de text default null,
  p_important_text text default null,
  p_important_text_en text default null,
  p_important_text_kr text default null,
  p_important_text_tr text default null,
  p_important_text_de text default null,
  p_link_post_id bigint default null,
  p_sort_order integer default 0,
  p_published boolean default true
) returns public.schedules
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.schedules;
begin
  if key <> 'REPLACE_WITH_YOUR_PASSPHRASE' then
    raise exception '合言葉が間違っています';
  end if;

  update public.schedules set
    title = p_title,
    title_en = p_title_en,
    title_kr = p_title_kr,
    title_tr = p_title_tr,
    title_de = p_title_de,
    rule_label = p_rule_label,
    tag_color = p_tag_color,
    image_url = p_image_url,
    recurrence_type = p_recurrence_type,
    day_of_week = p_day_of_week,
    interval_days = p_interval_days,
    start_date = p_start_date,
    specific_date = p_specific_date,
    st_time = p_st_time,
    note_text = p_note_text,
    note_text_en = p_note_text_en,
    note_text_kr = p_note_text_kr,
    note_text_tr = p_note_text_tr,
    note_text_de = p_note_text_de,
    important_text = p_important_text,
    important_text_en = p_important_text_en,
    important_text_kr = p_important_text_kr,
    important_text_tr = p_important_text_tr,
    important_text_de = p_important_text_de,
    link_post_id = p_link_post_id,
    sort_order = p_sort_order,
    published = p_published,
    updated_at = now()
  where id = schedule_id
  returning * into result;

  return result;
end;
$$;

grant execute on function public.create_schedule to anon, authenticated;
grant execute on function public.update_schedule to anon, authenticated;

-- list_all_schedules / delete_schedule はシグネチャ変更なし、再作成不要です。

-- ============================================================
-- 実行後の確認:
--   select recurrence_type, day_of_week, interval_days, start_date, specific_date
--   from public.schedules;
-- がエラーなく返ってくれば成功です。
--
--   insert into public.schedules(title, recurrence_type, day_of_week, st_time)
--   values ('動作確認', 'weekly', array[1,4]::smallint[], '11:00');
-- のように複数曜日({1,4}=月+木)を直接INSERTして確認することもできます
-- (確認後は delete from public.schedules where title = '動作確認'; で削除してください)。
-- ============================================================
