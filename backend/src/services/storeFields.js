/**
 * Shared store profile handling for the store portal and the admin review pages.
 */

export const STORE_PROFILE_FIELDS = [
  'name', 'tagline', 'description', 'businessPermit',
  'email', 'phone', 'address', 'city',
  'website', 'facebook', 'instagram', 'businessHours', 'logoUrl',
];

/** `owner` may be populated ({ email, name }) or an ObjectId. */
export const toStoreDto = (doc, extra = {}) => {
  const owner = doc.owner && typeof doc.owner === 'object' && 'email' in doc.owner ? doc.owner : null;
  return {
    id: doc._id.toString(),
    name: doc.name,
    tagline: doc.tagline || '',
    description: doc.description || '',
    businessPermit: doc.businessPermit || '',
    email: doc.email || '',
    phone: doc.phone || '',
    address: doc.address || '',
    city: doc.city || '',
    website: doc.website || '',
    facebook: doc.facebook || '',
    instagram: doc.instagram || '',
    businessHours: doc.businessHours || '',
    logoUrl: doc.logoUrl || '',
    status: doc.status,
    statusNote: doc.statusNote || '',
    reviewedAt: doc.reviewedAt || null,
    ownerEmail: owner ? owner.email : '',
    ownerName: owner ? owner.name || '' : '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ...extra,
  };
};

export function applyStoreFields(store, body) {
  for (const field of STORE_PROFILE_FIELDS) {
    if (body[field] !== undefined) {
      store[field] = String(body[field] ?? '').trim();
    }
  }
  return store;
}

/** Escapes user search text for use inside a MongoDB $regex. */
export const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
