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
      admin_settings: {
        Row: {
          admin_contact: string | null
          blocked_message: string | null
          default_plan_value: number
          id: string
          updated_at: string
        }
        Insert: {
          admin_contact?: string | null
          blocked_message?: string | null
          default_plan_value?: number
          id?: string
          updated_at?: string
        }
        Update: {
          admin_contact?: string | null
          blocked_message?: string | null
          default_plan_value?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      b2c_customers: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          company_id: string
          created_at: string
          first_visit_at: string
          id: string
          last_visit_at: string
          last_visit_form: string | null
          last_visit_table: string | null
          name: string
          total_visits: number
          whatsapp: string | null
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          company_id: string
          created_at?: string
          first_visit_at?: string
          id?: string
          last_visit_at?: string
          last_visit_form?: string | null
          last_visit_table?: string | null
          name: string
          total_visits?: number
          whatsapp?: string | null
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          company_id?: string
          created_at?: string
          first_visit_at?: string
          id?: string
          last_visit_at?: string
          last_visit_form?: string | null
          last_visit_table?: string | null
          name?: string
          total_visits?: number
          whatsapp?: string | null
        }
        Relationships: []
      }
      checkins: {
        Row: {
          company_id: string
          context: Database["public"]["Enums"]["visit_context"]
          created_at: string
          customer_id: string
          customer_name: string
          day_of_week: string
          id: string
          origin: string
          people_count: number
          source: string | null
          start_time: string
          table_id: string | null
          table_name: string | null
          visit_context: string
        }
        Insert: {
          company_id: string
          context: Database["public"]["Enums"]["visit_context"]
          created_at?: string
          customer_id: string
          customer_name?: string
          day_of_week?: string
          id?: string
          origin?: string
          people_count?: number
          source?: string | null
          start_time?: string
          table_id?: string | null
          table_name?: string | null
          visit_context?: string
        }
        Update: {
          company_id?: string
          context?: Database["public"]["Enums"]["visit_context"]
          created_at?: string
          customer_id?: string
          customer_name?: string
          day_of_week?: string
          id?: string
          origin?: string
          people_count?: number
          source?: string | null
          start_time?: string
          table_id?: string | null
          table_name?: string | null
          visit_context?: string
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
          approved_at: string | null
          approved_by: string | null
          blocked_at: string | null
          blocked_reason: string | null
          city: string | null
          created_at: string
          email_principal: string | null
          id: string
          internal_notes: string | null
          last_activity: string | null
          last_login: string | null
          last_payment_date: string | null
          logo_url: string | null
          monthly_fee: number
          name: string
          next_due_date: string | null
          payment_confirmation_date: string | null
          payment_informed_at: string | null
          payment_method: string
          payment_status: string
          phone: string | null
          plan_type: string
          primary_color: string | null
          responsible: string | null
          responsible_email: string | null
          slug: string
          status: string
          welcome_message: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          city?: string | null
          created_at?: string
          email_principal?: string | null
          id?: string
          internal_notes?: string | null
          last_activity?: string | null
          last_login?: string | null
          last_payment_date?: string | null
          logo_url?: string | null
          monthly_fee?: number
          name: string
          next_due_date?: string | null
          payment_confirmation_date?: string | null
          payment_informed_at?: string | null
          payment_method?: string
          payment_status?: string
          phone?: string | null
          plan_type?: string
          primary_color?: string | null
          responsible?: string | null
          responsible_email?: string | null
          slug: string
          status?: string
          welcome_message?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          city?: string | null
          created_at?: string
          email_principal?: string | null
          id?: string
          internal_notes?: string | null
          last_activity?: string | null
          last_login?: string | null
          last_payment_date?: string | null
          logo_url?: string | null
          monthly_fee?: number
          name?: string
          next_due_date?: string | null
          payment_confirmation_date?: string | null
          payment_informed_at?: string | null
          payment_method?: string
          payment_status?: string
          phone?: string | null
          plan_type?: string
          primary_color?: string | null
          responsible?: string | null
          responsible_email?: string | null
          slug?: string
          status?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      company_admin: {
        Row: {
          blocked_at: string | null
          blocked_reason: string | null
          company_id: string
          created_at: string
          id: string
          internal_notes: string | null
          last_payment_date: string | null
          monthly_fee: number
          next_due_date: string | null
          payment_method: string
          payment_status: string
          plan_type: string
          status: string
          updated_at: string
        }
        Insert: {
          blocked_at?: string | null
          blocked_reason?: string | null
          company_id: string
          created_at?: string
          id?: string
          internal_notes?: string | null
          last_payment_date?: string | null
          monthly_fee?: number
          next_due_date?: string | null
          payment_method?: string
          payment_status?: string
          plan_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          blocked_at?: string | null
          blocked_reason?: string | null
          company_id?: string
          created_at?: string
          id?: string
          internal_notes?: string | null
          last_payment_date?: string | null
          monthly_fee?: number
          next_due_date?: string | null
          payment_method?: string
          payment_status?: string
          plan_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_admin_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_licenses: {
        Row: {
          company_id: string
          created_at: string
          end_date: string | null
          id: string
          monthly_fee: number
          notes: string | null
          plan_type: string
          start_date: string
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_fee?: number
          notes?: string | null
          plan_type?: string
          start_date: string
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_fee?: number
          notes?: string | null
          plan_type?: string
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_licenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          status: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date: string
          payment_method?: string
          status?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      product_events: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string | null
          event_type: string
          id: string
          metadata: Json | null
          product_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          product_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
      product_media: {
        Row: {
          created_at: string
          id: string
          media_type: string
          media_url: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          media_type: string
          media_url: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          media_type?: string
          media_url?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey"
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
          cart_additions_count: number
          category: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          internal_code: string | null
          name: string
          order_count: number
          price: number
          revenue: number
          scan_count: number
          sku: string | null
          slug: string | null
          status: string
          stock_quantity: number | null
          unique_customers: number
          video_url: string | null
          views_count: number
        }
        Insert: {
          available?: boolean
          cart_additions_count?: number
          category?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          internal_code?: string | null
          name: string
          order_count?: number
          price?: number
          revenue?: number
          scan_count?: number
          sku?: string | null
          slug?: string | null
          status?: string
          stock_quantity?: number | null
          unique_customers?: number
          video_url?: string | null
          views_count?: number
        }
        Update: {
          available?: boolean
          cart_additions_count?: number
          category?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          internal_code?: string | null
          name?: string
          order_count?: number
          price?: number
          revenue?: number
          scan_count?: number
          sku?: string | null
          slug?: string | null
          status?: string
          stock_quantity?: number | null
          unique_customers?: number
          video_url?: string | null
          views_count?: number
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
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
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
      admin_set_company_status: {
        Args: { _company_id: string; _new_status: string; _reason?: string }
        Returns: undefined
      }
      auto_checkin:
        | {
            Args: {
              _company_id: string
              _customer_id: string
              _source?: string
              _table_id?: string
              _token: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_auth_user_id: string
              p_company_id: string
              p_customer_name: string
              p_source?: string
              p_table_id?: string
              p_table_name?: string
            }
            Returns: boolean
          }
      claim_own_company: {
        Args: { _name: string; _slug: string }
        Returns: string
      }
      complete_order: { Args: { _order_id: string }; Returns: undefined }
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
      create_customer_post:
        | {
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
        | {
            Args: {
              _category: string
              _companions: string
              _company_id: string
              _customer_id: string
              _image_url: string
              _text: string
              _token: string
              _video_url: string
            }
            Returns: string
          }
      delete_customer_post: {
        Args: { _customer_id: string; _post_id: string; _token: string }
        Returns: undefined
      }
      delete_order_item: { Args: { _item_id: string }; Returns: Json }
      ensure_super_admin: { Args: never; Returns: boolean }
      get_company_public: {
        Args: { _slug: string }
        Returns: {
          id: string
          logo_url: string
          name: string
          primary_color: string
          slug: string
          welcome_message: string
        }[]
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
      get_product_public: { Args: { _slug: string }; Returns: Json }
      get_table_public: {
        Args: { _company_id: string; _slug: string }
        Returns: {
          company_id: string
          id: string
          label: string
          slug: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_product_counter: {
        Args: { _field: string; _product_id: string }
        Returns: undefined
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
      list_service_present_public: {
        Args: { _company_id: string; _minutes?: number }
        Returns: {
          company_id: string
          context: string
          created_at: string
          customer_avatar_url: string
          customer_first_visit_at: string
          customer_id: string
          customer_last_visit_at: string
          customer_name: string
          customer_visit_count: number
          id: string
          source: string
          table_id: string
          table_label: string
          table_slug: string
        }[]
      }
      list_service_tables_public: {
        Args: { _company_id: string }
        Returns: {
          company_id: string
          id: string
          label: string
          slug: string
        }[]
      }
      mark_payment_informed:
        | { Args: never; Returns: undefined }
        | { Args: { _method?: string }; Returns: undefined }
      record_product_event: {
        Args: {
          _company_id: string
          _customer_id?: string
          _event_type?: string
          _metadata?: Json
          _product_id: string
        }
        Returns: string
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
      touch_company_activity: { Args: never; Returns: undefined }
      touch_company_login: { Args: never; Returns: undefined }
      update_customer_post: {
        Args: {
          _customer_id: string
          _image_url: string
          _post_id: string
          _text: string
          _token: string
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
      app_role: "owner" | "staff" | "admin"
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
      app_role: ["owner", "staff", "admin"],
      order_status: ["received", "completed"],
      post_author_type: ["business", "customer"],
      reaction_type: ["love", "dislike"],
      visit_context: ["sozinho", "casal", "amigos", "familia"],
    },
  },
} as const
