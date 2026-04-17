// Supabase Database Types
// 001~005 마이그레이션 반영. 나중에 supabase gen types로 교체 가능.

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
          google_business_url: string | null      // 002
          google_place_id: string | null           // 002
          review_summaries: ReviewSummaryJson[] | null  // 002
          images: PlaceImageJson[] | null          // 002
          latitude: number | null
          longitude: number | null
          owner_id: string | null                  // 003
          status: 'active' | 'pending' | 'rejected'  // 003
          created_at: string
          updated_at: string
        }
        Insert: PlacesInsert
        Update: Partial<PlacesInsert>
      }
      cities: {
        Row: {
          id: string
          slug: string
          name: string
          name_en: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['cities']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['cities']['Insert']>
      }
      categories: {
        Row: {
          id: string
          slug: string
          name: string
          name_en: string
          icon: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
      }
      blog_posts: {
        Row: {
          id: string
          slug: string
          title: string
          summary: string
          content: string
          city: string
          category: string | null
          tags: string[]
          status: 'draft' | 'active' | 'archived'
          published_at: string | null
          created_at: string
          updated_at: string
          // 011_blog_posts_extend.sql
          sector: string
          post_type: 'keyword' | 'compare' | 'guide' | 'general'
          related_place_slugs: string[]
          target_query: string | null
          faqs: Array<{ question: string; answer: string }>
          statistics: Array<{ label: string; value: string; note?: string }>
          sources: Array<{ title: string; url: string }>
          view_count: number
          quality_score: number | null
        }
        Insert: Omit<Database['public']['Tables']['blog_posts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['blog_posts']['Insert']>
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

interface ReviewSummaryJson {
  source: string
  positiveThemes: string[]
  negativeThemes: string[]
  sampleQuote?: string
  lastChecked: string
}

interface PlaceImageJson {
  url: string
  alt: string
  type: 'exterior' | 'interior' | 'treatment' | 'staff' | 'equipment'
}

/** places 테이블 Insert 타입 (id, timestamps 제외) */
interface PlacesInsert {
  slug: string
  name: string
  name_en?: string | null
  city: string
  category: string
  description: string
  address: string
  phone?: string | null
  opening_hours?: string[] | null
  image_url?: string | null
  rating?: number | null
  review_count?: number | null
  services?: ServiceJson[]
  faqs?: FaqJson[]
  tags?: string[]
  naver_place_url?: string | null
  kakao_map_url?: string | null
  google_business_url?: string | null
  google_place_id?: string | null
  review_summaries?: ReviewSummaryJson[] | null
  images?: PlaceImageJson[] | null
  latitude?: number | null
  longitude?: number | null
  owner_id?: string | null
  status?: 'active' | 'pending' | 'rejected'
}
