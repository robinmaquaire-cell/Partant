-- ============================================================
-- Partant ? — CORRECTIF : création d'événement avec du matériel
-- « à prévoir chacun » (la quantité était laissée vide)
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- ============================================================

-- Le script 0006 avait réécrit cette fonction à partir d'une version
-- antérieure au script 0004 : la quantité n'était renseignée que pour le
-- matériel collectif, alors que la colonne qty est obligatoire pour les
-- deux types depuis 0004. On rétablit « 1 par défaut, pour tout le
-- monde », en gardant la catégorie ajoutée par le script 0006.
create or replace function public.insert_equipment(p_event uuid, p_equipment jsonb)
returns void language plpgsql as $$
declare
  it jsonb;
  v_name text;
  v_kind text;
  v_qty integer;
  v_cat text;
begin
  for it in select * from jsonb_array_elements(coalesce(p_equipment, '[]'::jsonb)) loop
    v_name := trim(coalesce(it->>'name', ''));
    v_kind := it->>'kind';
    v_qty := coalesce((it->>'qty')::integer, 1);
    v_cat := nullif(trim(coalesce(it->>'category', '')), '');
    if char_length(v_name) not between 1 and 60 then
      raise exception 'Chaque objet de matériel doit avoir un nom (60 caractères max).';
    end if;
    if v_kind not in ('indiv', 'collectif') then
      raise exception 'Type de matériel invalide.';
    end if;
    if v_qty not between 1 and 999 then
      raise exception 'La quantité doit être entre 1 et 999.';
    end if;
    if char_length(coalesce(v_cat, '')) > 30 then
      raise exception 'Le nom de catégorie est trop long (30 caractères max).';
    end if;
    insert into equipment_items (event_id, name, kind, qty, category)
    values (p_event, v_name, v_kind, v_qty, v_cat);
  end loop;
end;
$$;
