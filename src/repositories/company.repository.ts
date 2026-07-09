import { supabase } from "@/integrations/supabase/client";
import type { Company } from "./types";

function mapCompany(row: any): Company {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color ?? "#8800AA",
    welcomeMessage: row.welcome_message ?? "Bem-vindo!",
  };
}

export const companyRepository = {
  async findBySlug(slug: string): Promise<Company | null> {
    const { data, error } = await supabase
      .rpc("get_company_public", { _slug: slug });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row ? mapCompany(row) : null;
  },


  async findById(id: string): Promise<Company | null> {
    const { data, error } = await supabase.from("companies").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapCompany(data) : null;
  },

  async update(id: string, patch: Partial<Company>): Promise<Company> {
    const { data, error } = await supabase
      .from("companies")
      .update({
        name: patch.name,
        logo_url: patch.logoUrl,
        primary_color: patch.primaryColor,
        welcome_message: patch.welcomeMessage,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return mapCompany(data);
  },
};
