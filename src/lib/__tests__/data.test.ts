import { describe, it, expect } from 'vitest'

describe('Data Repository', () => {
  describe('getPlaces', () => {
    it('should return places filtered by city and category', async () => {
      const { getPlaces } = await import('@/lib/data')
      const places = await getPlaces('cheonan', 'dermatology')
      expect(Array.isArray(places)).toBe(true)
      expect(places.length).toBeGreaterThan(0)
      places.forEach(place => {
        expect(place.city).toBe('cheonan')
        expect(place.category).toBe('dermatology')
      })
    })

    it('should return empty array for unknown city', async () => {
      const { getPlaces } = await import('@/lib/data')
      const places = await getPlaces('nonexistent', 'dermatology')
      expect(places).toEqual([])
    })

    it('should return empty array for unknown category', async () => {
      const { getPlaces } = await import('@/lib/data')
      const places = await getPlaces('cheonan', 'nonexistent')
      expect(places).toEqual([])
    })
  })

  describe('getPlaceBySlug', () => {
    it('should return a place by city, category, and slug', async () => {
      const { getPlaceBySlug } = await import('@/lib/data')
      const places = await import('@/lib/data').then(m => m.getPlaces('cheonan', 'dermatology'))
      if (places.length > 0) {
        const place = await getPlaceBySlug('cheonan', 'dermatology', places[0].slug)
        expect(place).toBeDefined()
        expect(place?.slug).toBe(places[0].slug)
        expect(place?.name).toBeTruthy()
      }
    })

    it('should return undefined for unknown slug', async () => {
      const { getPlaceBySlug } = await import('@/lib/data')
      const place = await getPlaceBySlug('cheonan', 'dermatology', 'nonexistent-slug')
      expect(place).toBeUndefined()
    })
  })

  describe('getCities', () => {
    it('should return all cities', async () => {
      const { getCities } = await import('@/lib/data')
      const cities = await getCities()
      expect(Array.isArray(cities)).toBe(true)
      expect(cities.length).toBeGreaterThan(0)
      cities.forEach(city => {
        expect(city.slug).toBeTruthy()
        expect(city.name).toBeTruthy()
      })
    })
  })

  describe('getCategories', () => {
    it('should return all categories', async () => {
      const { getCategories } = await import('@/lib/data')
      const categories = await getCategories()
      expect(Array.isArray(categories)).toBe(true)
      expect(categories.length).toBeGreaterThan(0)
      categories.forEach(cat => {
        expect(cat.slug).toBeTruthy()
        expect(cat.name).toBeTruthy()
      })
    })
  })

  describe('getAllPlaces', () => {
    it('should return all places', async () => {
      const { getAllPlaces } = await import('@/lib/data')
      const allPlaces = await getAllPlaces()
      expect(Array.isArray(allPlaces)).toBe(true)
      expect(allPlaces.length).toBeGreaterThan(0)
    })
  })

  describe('slug uniqueness', () => {
    it('should have unique slugs per city+category', async () => {
      const { getPlaces } = await import('@/lib/data')
      const places = await getPlaces('cheonan', 'dermatology')
      const slugs = places.map(p => p.slug)
      const uniqueSlugs = new Set(slugs)
      expect(slugs.length).toBe(uniqueSlugs.size)
    })
  })
})
