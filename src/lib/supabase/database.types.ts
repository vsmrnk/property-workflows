// Типи схеми бази. Оновлюйте разом із міграцією: готовий файл — у Summary прогону job db-check у CI
// (supabase gen types typescript --local на одноразовій базі); або npm run db:types після npx supabase link на ваш проєкт. Ця стартова версія написана вручну
// й описує таблиці й функції з міграцій 20261012000000_profiles_and_roles.sql і 20261019120100_templates_and_runs.sql.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          role: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          role?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      templates: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      template_sections: {
        Row: {
          id: string;
          template_id: string;
          name: string;
          position: number;
        };
        Insert: {
          id?: string;
          template_id: string;
          name: string;
          position?: number;
        };
        Update: {
          id?: string;
          template_id?: string;
          name?: string;
          position?: number;
        };
        Relationships: [];
      };
      template_tasks: {
        Row: {
          id: string;
          template_id: string;
          section_id: string;
          name: string;
          required: boolean;
          position: number;
        };
        Insert: {
          id?: string;
          template_id: string;
          section_id: string;
          name: string;
          required?: boolean;
          position?: number;
        };
        Update: {
          id?: string;
          template_id?: string;
          section_id?: string;
          name?: string;
          required?: boolean;
          position?: number;
        };
        Relationships: [];
      };
      runs: {
        Row: {
          id: string;
          template_id: string;
          case_name: string;
          manager_id: string;
          status: string;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          template_id: string;
          case_name: string;
          manager_id: string;
          status?: string;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          template_id?: string;
          case_name?: string;
          manager_id?: string;
          status?: string;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "runs_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "templates";
            referencedColumns: ["id"];
          },
        ];
      };
      run_tasks: {
        Row: {
          id: string;
          run_id: string;
          section_name: string;
          section_position: number;
          name: string;
          required: boolean;
          position: number;
          assignee_id: string;
          status: string;
          done_at: string | null;
          done_by: string | null;
        };
        Insert: {
          id?: string;
          run_id: string;
          section_name: string;
          section_position?: number;
          name: string;
          required: boolean;
          position?: number;
          assignee_id: string;
          status?: string;
          done_at?: string | null;
          done_by?: string | null;
        };
        Update: {
          id?: string;
          run_id?: string;
          section_name?: string;
          section_position?: number;
          name?: string;
          required?: boolean;
          position?: number;
          assignee_id?: string;
          status?: string;
          done_at?: string | null;
          done_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "run_tasks_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "runs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      launch_run: {
        Args: { p_template_id: string; p_case_name: string; p_assignments?: Json };
        Returns: string;
      };
      mark_task_done: {
        Args: { p_task_id: string };
        Returns: undefined;
      };
      list_assignable_users: {
        Args: Record<PropertyKey, never>;
        Returns: { id: string; full_name: string | null; email: string | null }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
