import { isInteriorPhoto, filterInteriorPhotos } from '../../src/utils/interiorImageFilter.js';

describe('Interior Image Filter', () => {
  describe('isInteriorPhoto', () => {
    it('should reject photos with blocklisted terms', () => {
      const coffeePhoto = { alt: 'A woman drinking coffee in a cafe' };
      const fashionPhoto = { alt: 'Fashion model posing with wallet' };
      const sunsetPhoto = { alt: 'Beautiful sunset over mountain' };
      
      expect(isInteriorPhoto(coffeePhoto)).toBe(false);
      expect(isInteriorPhoto(fashionPhoto)).toBe(false);
      expect(isInteriorPhoto(sunsetPhoto)).toBe(false);
    });

    it('should allow photos matching allowlisted terms', () => {
      const roomPhoto = { alt: 'A modern minimalist living room interior with a sofa' };
      const bedPhoto = { alt: 'Cozy bedroom design with a bed and lamp' };
      
      expect(isInteriorPhoto(roomPhoto)).toBe(true);
      expect(isInteriorPhoto(bedPhoto)).toBe(true);
    });

    it('should handle null/undefined inputs', () => {
      expect(isInteriorPhoto(null)).toBe(false);
      expect(isInteriorPhoto(undefined)).toBe(false);
    });
  });

  describe('filterInteriorPhotos', () => {
    it('should filter out blocklisted items and keep allowlisted ones', () => {
      const photos = [
        { id: 1, alt: 'minimalist living room interior design', width: 800, height: 600 },
        { id: 2, alt: 'delicious breakfast food eggs coffee', width: 800, height: 600 },
        { id: 3, alt: 'modern bedroom cozy bed design', width: 800, height: 600 },
        { id: 4, alt: 'perfume bottle makeup cosmetic', width: 800, height: 600 },
      ];

      const filtered = filterInteriorPhotos(photos);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe(1);
      expect(filtered[1].id).toBe(3);
    });
  });
});
