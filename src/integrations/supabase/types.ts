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
      analysis_history: {
        Row: {
          created_at: string
          id: string
          period_end: string | null
          period_start: string | null
          result: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          result: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          result?: Json
          user_id?: string
        }
        Relationships: []
      }
      balance_sheet_assets: {
        Row: {
          acquisition_date: string | null
          category: Database["public"]["Enums"]["asset_category"]
          created_at: string
          current_value: number
          id: string
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acquisition_date?: string | null
          category: Database["public"]["Enums"]["asset_category"]
          created_at?: string
          current_value?: number
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acquisition_date?: string | null
          category?: Database["public"]["Enums"]["asset_category"]
          created_at?: string
          current_value?: number
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      balance_sheet_liabilities: {
        Row: {
          category: Database["public"]["Enums"]["liability_category"]
          created_at: string
          current_balance: number
          end_date: string | null
          id: string
          interest_rate: number | null
          monthly_payment: number | null
          name: string
          notes: string | null
          start_date: string | null
          total_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["liability_category"]
          created_at?: string
          current_balance?: number
          end_date?: string | null
          id?: string
          interest_rate?: number | null
          monthly_payment?: number | null
          name: string
          notes?: string | null
          start_date?: string | null
          total_value?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["liability_category"]
          created_at?: string
          current_balance?: number
          end_date?: string | null
          id?: string
          interest_rate?: number | null
          monthly_payment?: number | null
          name?: string
          notes?: string | null
          start_date?: string | null
          total_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          dre_type: Database["public"]["Enums"]["dre_type"]
          id: string
          is_default: boolean
          name: string
          parent_id: string | null
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          dre_type: Database["public"]["Enums"]["dre_type"]
          id?: string
          is_default?: boolean
          name: string
          parent_id?: string | null
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          dre_type?: Database["public"]["Enums"]["dre_type"]
          id?: string
          is_default?: boolean
          name?: string
          parent_id?: string | null
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      net_worth_history: {
        Row: {
          created_at: string
          id: string
          month: string
          net_worth: number
          total_assets: number
          total_liabilities: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          net_worth?: number
          total_assets?: number
          total_liabilities?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          net_worth?: number
          total_assets?: number
          total_liabilities?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projections: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          id: string
          month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          id?: string
          month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          id?: string
          month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projections_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_access: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          permission: string
          shared_with_email: string
          shared_with_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          permission?: string
          shared_with_email: string
          shared_with_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          permission?: string
          shared_with_email?: string
          shared_with_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category_id: string
          comment: string | null
          created_at: string
          date: string
          id: string
          installment_group: string | null
          installment_number: number | null
          is_installment: boolean
          total_installments: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id: string
          comment?: string | null
          created_at?: string
          date?: string
          id?: string
          installment_group?: string | null
          installment_number?: number | null
          is_installment?: boolean
          total_installments?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          comment?: string | null
          created_at?: string
          date?: string
          id?: string
          installment_group?: string | null
          installment_number?: number | null
          is_installment?: boolean
          total_installments?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_plans: {
        Row: {
          created_at: string
          id: string
          plan: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      seed_default_categories: {
        Args: { p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      asset_category:
        | "conta_corrente"
        | "poupanca"
        | "dinheiro_caixa"
        | "renda_fixa"
        | "acoes"
        | "fundos"
        | "criptomoedas"
        | "imoveis"
        | "veiculos"
        | "participacoes"
        | "outros_bens"
      dre_type:
        | "receita"
        | "desconto"
        | "custo"
        | "despesa"
        | "depreciacao"
        | "resultado_financeiro"
        | "outras_receitas"
        | "impostos"
        | "investimento"
      liability_category:
        | "cartao_credito"
        | "emprestimo"
        | "financiamento_imobiliario"
        | "financiamento_veiculo"
        | "parcelamento"
        | "impostos_pagar"
        | "outros_passivos"
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
      asset_category: [
        "conta_corrente",
        "poupanca",
        "dinheiro_caixa",
        "renda_fixa",
        "acoes",
        "fundos",
        "criptomoedas",
        "imoveis",
        "veiculos",
        "participacoes",
        "outros_bens",
      ],
      dre_type: [
        "receita",
        "desconto",
        "custo",
        "despesa",
        "depreciacao",
        "resultado_financeiro",
        "outras_receitas",
        "impostos",
        "investimento",
      ],
      liability_category: [
        "cartao_credito",
        "emprestimo",
        "financiamento_imobiliario",
        "financiamento_veiculo",
        "parcelamento",
        "impostos_pagar",
        "outros_passivos",
      ],
    },
  },
} as const
