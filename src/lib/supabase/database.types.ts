// Supabase Database Types
// 자동 생성 대신 수동 정의. 나중에 supabase gen types로 교체 가능.

export interface Database {
  public: {
    Tables: {
      places: {
        Row: {
          id: string
          slug: string
          name: string
          name_en: string | null
          city: string
          category: string
          description: string
          address: string
          phone: string | null
          opening_hours: string[] | null
          image_url: string | null
          rating: number | null
          review_count: number | null
          services: ServiceJson[]
          faqs: FaqJson[]
          tags: string[]
          naver_place_url: string | null
          kakao_map_url: string | null
          latitude: number | null
          longitude: number | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['places']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['places']['Insert']>
      }
      test_prompts: {
        Row: {
          id: string
          text: string
          category: string
          city: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['test_prompts']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['test_prompts']['Insert']>
      }
      citation_results: {
        Row: {
          id: string
          prompt_id: string
          engine: 'chatgpt' | 'claude' | 'gemini'
          response: string
          cited_sources: string[]
          cited_places: string[]
          aiplace_cited: boolean
          session_id: string
          tested_at: string
        }
        Insert: Omit<Database['public']['Tables']['citation_results']['Row'], 'id' | 'tested_at'>
        Update: Partial<Database['public']['Tables']['citation_results']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

interface ServiceJson {
  name: string
  description?: string
  priceRange?: string
}

interface FaqJson {
  question: string
  answer: string
}
