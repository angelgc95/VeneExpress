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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          id: string
          line1: string
          line2: string | null
          name: string
          phone: string | null
          postal_code: string | null
          state: string | null
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          id?: string
          line1: string
          line2?: string | null
          name: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          id?: string
          line1?: string
          line2?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
        }
        Relationships: []
      }
      admin_allowlist: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      boxes: {
        Row: {
          applied_rate: number | null
          box_id: string
          calculated_price: number | null
          created_at: string
          final_price: number | null
          height_in: number
          id: string
          length_in: number
          notes: string | null
          override_reason: string | null
          price_override: number | null
          shipment_id: string
          volume_ft3: number | null
          width_in: number
        }
        Insert: {
          applied_rate?: number | null
          box_id: string
          calculated_price?: number | null
          created_at?: string
          final_price?: number | null
          height_in: number
          id?: string
          length_in: number
          notes?: string | null
          override_reason?: string | null
          price_override?: number | null
          shipment_id: string
          volume_ft3?: number | null
          width_in: number
        }
        Update: {
          applied_rate?: number | null
          box_id?: string
          calculated_price?: number | null
          created_at?: string
          final_price?: number | null
          height_in?: number
          id?: string
          length_in?: number
          notes?: string | null
          override_reason?: string | null
          price_override?: number | null
          shipment_id?: string
          volume_ft3?: number | null
          width_in?: number
        }
        Relationships: [
          {
            foreignKeyName: "boxes_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          email: string | null
          id: number
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          email?: string | null
          id?: number
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          email?: string | null
          id?: number
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      invoice_counter: {
        Row: {
          id: number
          last_number: number
        }
        Insert: {
          id?: number
          last_number?: number
        }
        Update: {
          id?: number
          last_number?: number
        }
        Relationships: []
      }
      invoice_line_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          line_total: number
          qty: number
          type: Database["public"]["Enums"]["invoice_line_type"]
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          line_total: number
          qty?: number
          type?: Database["public"]["Enums"]["invoice_line_type"]
          unit_price: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          qty?: number
          type?: Database["public"]["Enums"]["invoice_line_type"]
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          adjustment: number
          balance: number
          created_at: string
          finalized_at: string | null
          id: string
          invoice_number: string
          is_finalized: boolean
          paid_amount: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          shipment_id: string
          subtotal: number
          total: number
        }
        Insert: {
          adjustment?: number
          balance?: number
          created_at?: string
          finalized_at?: string | null
          id?: string
          invoice_number: string
          is_finalized?: boolean
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shipment_id: string
          subtotal?: number
          total?: number
        }
        Update: {
          adjustment?: number
          balance?: number
          created_at?: string
          finalized_at?: string | null
          id?: string
          invoice_number?: string
          is_finalized?: boolean
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shipment_id?: string
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          channel: string
          id: string
          message_body: string | null
          provider_message_id: string | null
          sent_at: string
          shipment_id: string
          status: string
          template_name: string | null
          to_phone: string
        }
        Insert: {
          channel?: string
          id?: string
          message_body?: string | null
          provider_message_id?: string | null
          sent_at?: string
          shipment_id: string
          status?: string
          template_name?: string | null
          to_phone: string
        }
        Update: {
          channel?: string
          id?: string
          message_body?: string | null
          provider_message_id?: string | null
          sent_at?: string
          shipment_id?: string
          status?: string
          template_name?: string | null
          to_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string
          reference: string | null
        }
        Insert: {
          amount: number
          id?: string
          invoice_id: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          reference?: string | null
        }
        Update: {
          amount?: number
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          id: string
          is_active: boolean
          name: string
          rate_per_ft3: number
          route: string
          service_type: Database["public"]["Enums"]["service_type"]
          updated_at: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          rate_per_ft3: number
          route?: string
          service_type: Database["public"]["Enums"]["service_type"]
          updated_at?: string
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          rate_per_ft3?: number
          route?: string
          service_type?: Database["public"]["Enums"]["service_type"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          created_at: string
          full_name: string | null
          id: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          full_name?: string | null
          id?: string
          user_id: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          full_name?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      shipment_counter: {
        Row: {
          id: number
          last_number: number
        }
        Insert: {
          id?: number
          last_number?: number
        }
        Update: {
          id?: number
          last_number?: number
        }
        Relationships: []
      }
      shipments: {
        Row: {
          created_at: string
          currency: string
          customer_id: string
          id: string
          public_tracking_code: string | null
          receiver_address_id: string | null
          sender_address_id: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          shipment_id: string
          status: Database["public"]["Enums"]["shipment_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_id: string
          id?: string
          public_tracking_code?: string | null
          receiver_address_id?: string | null
          sender_address_id?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          shipment_id?: string
          status?: Database["public"]["Enums"]["shipment_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          customer_id?: string
          id?: string
          public_tracking_code?: string | null
          receiver_address_id?: string | null
          sender_address_id?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          shipment_id?: string
          status?: Database["public"]["Enums"]["shipment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_receiver_address_id_fkey"
            columns: ["receiver_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_sender_address_id_fkey"
            columns: ["sender_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      standard_items: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: []
      }
      status_events: {
        Row: {
          actor_user_id: string | null
          box_id: string | null
          created_at: string
          id: string
          note: string | null
          shipment_id: string
          status: Database["public"]["Enums"]["shipment_status"]
        }
        Insert: {
          actor_user_id?: string | null
          box_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          shipment_id: string
          status: Database["public"]["Enums"]["shipment_status"]
        }
        Update: {
          actor_user_id?: string | null
          box_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          shipment_id?: string
          status?: Database["public"]["Enums"]["shipment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "status_events_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_invoice_number: { Args: never; Returns: string }
      generate_shipment_id: { Args: never; Returns: string }
      get_tracking_info: { Args: { p_tracking_code: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "staff" | "readonly"
      invoice_line_type: "shipping" | "discount" | "misc"
      payment_method: "cash" | "zelle" | "card" | "other"
      payment_status: "Unpaid" | "Partial" | "Paid"
      service_type: "SEA" | "AIR"
      shipment_status:
        | "Label Created"
        | "Received"
        | "Paid"
        | "Shipped"
        | "Arrived in Destination"
        | "Released by Customs"
        | "Ready for Delivery"
        | "Delivered"
        | "Cancelled"
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
      app_role: ["admin", "staff", "readonly"],
      invoice_line_type: ["shipping", "discount", "misc"],
      payment_method: ["cash", "zelle", "card", "other"],
      payment_status: ["Unpaid", "Partial", "Paid"],
      service_type: ["SEA", "AIR"],
      shipment_status: [
        "Label Created",
        "Received",
        "Paid",
        "Shipped",
        "Arrived in Destination",
        "Released by Customs",
        "Ready for Delivery",
        "Delivered",
        "Cancelled",
      ],
    },
  },
} as const
