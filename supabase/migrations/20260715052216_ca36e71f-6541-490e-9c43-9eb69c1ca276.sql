CREATE OR REPLACE FUNCTION private.create_customer_post(
  _customer_id uuid,
  _token uuid,
  _company_id uuid,
  _text text,
  _image_url text,
  _category text,
  _companions text,
  _video_url text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_id uuid;
  cust_company uuid;
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  SELECT company_id INTO cust_company FROM public.customers WHERE id = _customer_id;
  IF cust_company IS NULL OR cust_company <> _company_id THEN
    RAISE EXCEPTION 'customer/company mismatch';
  END IF;

  INSERT INTO public.posts (company_id, author_type, customer_id, text, image_url, video_url, category, companions)
  VALUES (_company_id, 'customer', _customer_id, _text, _image_url, _video_url, _category,
          NULLIF(_companions, '')::visit_context)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_customer_post(
  _customer_id uuid, _token uuid, _company_id uuid,
  _text text, _image_url text, _category text, _companions text, _video_url text
) RETURNS uuid LANGUAGE sql SET search_path = public AS $$
  SELECT private.create_customer_post(_customer_id, _token, _company_id, _text, _image_url, _category, _companions, _video_url);
$$;

REVOKE ALL ON FUNCTION public.create_customer_post(uuid, uuid, uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_post(uuid, uuid, uuid, text, text, text, text, text) TO anon, authenticated;