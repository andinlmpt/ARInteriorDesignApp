/**
 * App brand: VisionSpace (logo and name). Maharlika Furniture and Home Furnishing is the
 * furniture company behind the app: `fullName` and `contact` are theirs (About Us, Help).
 */

export const BRAND = {
  name: 'VisionSpace',
  fullName: 'Maharlika Furniture and Home Furnishing',
  tagline: 'Your vision, Our craft',
  legacyAppName: 'AR Interior Design',
  contact: {
    phoneDisplay: '0961 375 1520',
    phoneTel: '09613751520',
    email: 'maharlikafurniture2010@gmail.com',
  },
  colors: {
    navy: '#0C295F',
    orange: '#E69868',
    /** Mid navy used as a tertiary brand tone (replaces legacy olive). */
    olive: '#3E5A8C',
    white: '#FFFFFF',
  },
} as const;

/** VisionSpace cube mark (square); screens show `BRAND.name` beside or under it. */
export const BRAND_LOGO = require('@/assets/images/visionspace-mark.png');
