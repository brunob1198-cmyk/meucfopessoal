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
      category_rules: {
        Row: {
          category_id: string
          created_at: string
          id: string
          keyword: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          keyword: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          keyword?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_accounts: {
        Row: {
          account_name: string | null
          account_type: string
          balance: number | null
          connector_logo: string | null
          connector_name: string
          created_at: string
          id: string
          last_sync_at: string | null
          pluggy_item_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          account_type?: string
          balance?: number | null
          connector_logo?: string | null
          connector_name: string
          created_at?: string
          id?: string
          last_sync_at?: string | null
          pluggy_item_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          account_type?: string
          balance?: number | null
          connector_logo?: string | null
          connector_name?: string
          created_at?: string
          id?: string
          last_sync_at?: string | null
          pluggy_item_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_dreams: {
        Row: {
          accumulated_value: number
          category: Database["public"]["Enums"]["dream_category"]
          completed_at: string | null
          created_at: string
          custom_category: string | null
          description: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["dream_status"]
          target_date: string | null
          target_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accumulated_value?: number
          category?: Database["public"]["Enums"]["dream_category"]
          completed_at?: string | null
          created_at?: string
          custom_category?: string | null
          description?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["dream_status"]
          target_date?: string | null
          target_value?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accumulated_value?: number
          category?: Database["public"]["Enums"]["dream_category"]
          completed_at?: string | null
          created_at?: string
          custom_category?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["dream_status"]
          target_date?: string | null
          target_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_health_history: {
        Row: {
          created_at: string
          emergency_reserve_score: number
          expense_control_score: number
          id: string
          indebtedness_score: number
          liquidity_score: number
          month: string
          savings_capacity_score: number
          total_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emergency_reserve_score: number
          expense_control_score: number
          id?: string
          indebtedness_score: number
          liquidity_score: number
          month: string
          savings_capacity_score: number
          total_score: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          emergency_reserve_score?: number
          expense_control_score?: number
          id?: string
          indebtedness_score?: number
          liquidity_score?: number
          month?: string
          savings_capacity_score?: number
          total_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      imported_transactions: {
        Row: {
          amount: number
          confirmed_category_id: string | null
          connected_account_id: string
          created_at: string
          date: string
          description: string | null
          external_id: string | null
          id: string
          status: string
          suggested_category_id: string | null
          transaction_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          confirmed_category_id?: string | null
          connected_account_id: string
          created_at?: string
          date: string
          description?: string | null
          external_id?: string | null
          id?: string
          status?: string
          suggested_category_id?: string | null
          transaction_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          confirmed_category_id?: string | null
          connected_account_id?: string
          created_at?: string
          date?: string
          description?: string | null
          external_id?: string | null
          id?: string
          status?: string
          suggested_category_id?: string | null
          transaction_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "imported_transactions_confirmed_category_id_fkey"
            columns: ["confirmed_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_transactions_connected_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "connected_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_transactions_suggested_category_id_fkey"
            columns: ["suggested_category_id"]
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
          birth_date: string | null
          created_at: string
          display_name: string | null
          gender: string | null
          id: string
          profession: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          gender?: string | null
          id?: string
          profession?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          gender?: string | null
          id?: string
          profession?: string | null
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
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          id?: string
          month: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          id?: string
          month?: string
          notes?: string | null
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
          payment_date: string
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
          payment_date?: string
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
          payment_date?: string
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
      dream_category:
        | "casa_propria"
        | "carro"
        | "viagem"
        | "cirurgia"
        | "educacao"
        | "aposentadoria"
        | "independencia_financeira"
        | "outro"
      dream_status: "em_progresso" | "proximo" | "em_risco" | "concluido"
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
      dream_category: [
        "casa_propria",
        "carro",
        "viagem",
        "cirurgia",
        "educacao",
        "aposentadoria",
        "independencia_financeira",
        "outro",
      ],
      dream_status: ["em_progresso", "proximo", "em_risco", "concluido"],
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
