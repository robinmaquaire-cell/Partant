-- ============================================================
-- Partant ? — Complément M3 : quantité par personne pour le
-- matériel individuel (ex. « 2 gourdes par personne »).
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- ============================================================

-- Avant : quantité interdite sur le matériel individuel.
-- Après : quantité obligatoire partout (1 par défaut).
alter table public.equipment_items drop constraint qty_selon_type;
update public.equipment_items set qty = 1 where qty is null;
alter table public.equipment_items
  alter column qty set not null,
  alter column qty set default 1;
alter table public.equipment_items
  add constraint qty_selon_type check (qty between 1 and 999);

-- La fonction d'insertion du matériel accepte désormais une
-- quantité pour les deux types (remplace celle du script 0003).
create or replace function public.insert_equipment(p_event uuid, p_equipment jsonb)
returns void language plpgsql as $$
declare
  it jsonb;
  v_name text;
  v_kind text;
  v_qty integer;
begin
  for it in select * from jsonb_array_elements(coalesce(p_equipment, '[]'::jsonb)) loop
    v_name := trim(coalesce(it->>'name', ''));
    v_kind := it->>'kind';
    v_qty := coalesce((it->>'qty')::integer, 1);
    if char_length(v_name) not between 1 and 60 then
      raise exception 'Chaque objet de matériel doit avoir un nom (60 caractères max).';
    end if;
    if v_kind not in ('indiv', 'collectif') then
      raise exception 'Type de matériel invalide.';
    end if;
    if v_qty not between 1 and 999 then
      raise exception 'La quantité doit être entre 1 et 999.';
    end if;
    insert into equipment_items (event_id, name, kind, qty)
    values (p_event, v_name, v_kind, v_qty);
  end loop;
end;
$$;
