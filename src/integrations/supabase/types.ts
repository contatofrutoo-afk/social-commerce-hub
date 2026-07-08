export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      checkins: {
        Row: {
          company_id: string
          context: Database["public"]["Enums"]["visit_context"]
          created_at: string
          customer_id: string
          id: string
          source: string | null
          table_id: string | null
        }
        Insert: {
          company_id: string
          context: Database["public"]["Enums"]["visit_context"]
          created_at?: string
          customer_id: string
          id?: string
          source?: string | null
          table_id?: string | null
        }
        Update: {
          company_id?: string
          context?: Database["public"]["Enums"]["visit_context"]
          created_at?: string
          customer_id?: string
          id?: string
          source?: string | null
          table_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          image_url: string | null
          post_id: string
          text: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          image_url?: string | null
          post_id: string
          text: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          image_url?: string | null
          post_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          slug: string
          welcome_message: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          slug: string
          welcome_message?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          slug?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          avatar_url: string | null
          company_id: string
          created_at: string
          first_visit_at: string
          id: string
          last_visit_at: string
          name: string
          session_token: string
          visit_count: number
          whatsapp: string
        }
        Insert: {
          avatar_url?: string | null
          company_id: string
          created_at?: string
          first_visit_at?: string
          id?: string
          last_visit_at?: string
          name: string
          session_token?: string
          visit_count?: number
          whatsapp: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string
          created_at?: string
          first_visit_at?: string
          id?: string
          last_visit_at?: string
          name?: string
          session_token?: string
          visit_count?: number
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          note: string | null
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          note?: string | null
          order_id: string
          product_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          id?: string
          note?: string | null
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          id: string
          note: string | null
          status: Database["public"]["Enums"]["order_status"]
          table_id: string | null
          total: number
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string | null
          total?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      post_products: {
        Row: {
          post_id: string
          product_id: string
        }
        Insert: {
          post_id: string
          product_id: string
        }
        Update: {
          post_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_products_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          customer_id: string
          post_id: string
          type: Database["public"]["Enums"]["reaction_type"]
        }
        Insert: {
          created_at?: string
          customer_id: string
          post_id: string
          type: Database["public"]["Enums"]["reaction_type"]
        }
        Update: {
          created_at?: string
          customer_id?: string
          post_id?: string
          type?: Database["public"]["Enums"]["reaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_type: Database["public"]["Enums"]["post_author_type"]
          category: string | null
          companions: Database["public"]["Enums"]["visit_context"] | null
          company_id: string
          created_at: string
          customer_id: string | null
          id: string
          image_url: string | null
          text: string | null
          video_url: string | null
        }
        Insert: {
          author_type: Database["public"]["Enums"]["post_author_type"]
          category?: string | null
          companions?: Database["public"]["Enums"]["visit_context"] | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          image_url?: string | null
          text?: string | null
          video_url?: string | null
        }
        Update: {
          author_type?: Database["public"]["Enums"]["post_author_type"]
          category?: string | null
          companions?: Database["public"]["Enums"]["visit_context"] | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          image_url?: string | null
          text?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_likes: {
        Row: {
          created_at: string
          customer_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_likes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_likes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_wishes: {
        Row: {
          created_at: string
          customer_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_wishes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_wishes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available: boolean
          category: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
        }
        Insert: {
          available?: boolean
          category?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price?: number
        }
        Update: {
          available?: boolean
          category?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          company_id: string
          created_at: string
          id: string
          label: string
          slug: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          label: string
          slug: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          label?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "tables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_own_company: {
        Args: { _name: string; _slug: string }
        Returns: string
      }
      create_checkin: {
        Args: {
          _company_id: string
          _context: string
          _customer_id: string
          _source?: string
          _table_id?: string
          _token: string
        }
        Returns: string
      }
      create_customer_comment: {
        Args: {
          _customer_id: string
          _image_url: string
          _post_id: string
          _text: string
          _token: string
        }
        Returns: string
      }
      create_customer_order: {
        Args: {
          _company_id: string
          _customer_id: string
          _items: Json
          _note: string
          _table_id?: string
          _token: string
        }
        Returns: string
      }
      create_customer_post: {
        Args: {
          _category: string
          _companions: string
          _company_id: string
          _customer_id: string
          _image_url: string
          _text: string
          _token: string
        }
        Returns: string
      }
      get_customer_self: {
        Args: { _customer_id: string; _token: string }
        Returns: {
          avatar_url: string | null
          company_id: string
          created_at: string
          first_visit_at: string
          id: string
          last_visit_at: string
          name: string
          session_token: string
          visit_count: number
          whatsapp: string
        }[]
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_customer_orders: {
        Args: { _customer_id: string; _token: string }
        Returns: Json[]
      }
      list_public_comments: { Args: { _post_id: string }; Returns: Json[] }
      list_public_posts: {
        Args: { _company_id: string; _viewer_customer_id?: string }
        Returns: Json[]
      }
      set_post_reaction: {
        Args: {
          _customer_id: string
          _post_id: string
          _token: string
          _type: string
        }
        Returns: undefined
      }
      toggle_product_like: {
        Args: {
          _customer_id: string
          _liked: boolean
          _product_id: string
          _token: string
        }
        Returns: undefined
      }
      toggle_product_wish: {
        Args: {
          _customer_id: string
          _product_id: string
          _token: string
          _wished: boolean
        }
        Returns: undefined
      }
      update_customer_self: {
        Args: {
          _avatar_url: string
          _customer_id: string
          _name: string
          _token: string
          _whatsapp: string
        }
        Returns: undefined
      }
      upsert_customer_visit: {
        Args: { _company_id: string; _name: string; _whatsapp: string }
        Returns: {
          customer_id: string
          session_token: string
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "staff"
      order_status: "received" | "completed"
      post_author_type: "business" | "customer"
      reaction_type: "love" | "dislike"
      visit_context: "sozinho" | "casal" | "amigos" | "familia"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "staff"],
      order_status: ["received", "completed"],
      post_author_type: ["business", "customer"],
      reaction_type: ["love", "dislike"],
      visit_context: ["sozinho", "casal", "amigos", "familia"],
    },
  },
} as const
