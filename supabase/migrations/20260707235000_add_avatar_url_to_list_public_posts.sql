-- Adiciona avatar do cliente e logo da empresa no retorno de list_public_posts

CREATE OR REPLACE FUNCTION private.list_public_posts(_company_id uuid, _viewer_customer_id uuid DEFAULT NULL)
RETURNS SETOF json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT to_json(p) FROM (
    SELECT
      po.id, po.company_id, po.author_type, po.customer_id,
      c.name AS customer_name,
      c.avatar_url AS customer_avatar_url,
      co.logo_url AS company_logo_url,
      po.image_url, po.video_url, po.text, po.category, po.companions, po.created_at,
      (SELECT count(*)::int FROM post_reactions r WHERE r.post_id=po.id AND r.type='love') AS love_count,
      (SELECT count(*)::int FROM post_reactions r WHERE r.post_id=po.id AND r.type='dislike') AS dislike_count,
      (SELECT count(*)::int FROM comments cm WHERE cm.post_id=po.id) AS comment_count,
      (SELECT r.type::text FROM post_reactions r WHERE r.post_id=po.id AND r.customer_id=_viewer_customer_id LIMIT 1) AS my_reaction,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id',pr.id,'company_id',pr.company_id,'name',pr.name,'category',pr.category,
          'price',pr.price,'image_url',pr.image_url,'available',pr.available,'description',pr.description))
        FROM post_products pp JOIN products pr ON pr.id=pp.product_id
        WHERE pp.post_id=po.id
      ), '[]'::json) AS products
    FROM posts po
    LEFT JOIN customers c ON c.id=po.customer_id
    LEFT JOIN companies co ON co.id=po.company_id
    WHERE po.company_id=_company_id
    ORDER BY po.created_at DESC
    LIMIT 50
  ) p;
$$;

