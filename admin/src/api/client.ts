const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const TOKEN_KEY = 'maharlika_admin_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Always bypass HTTP cache — stale 304 responses were keeping quantity/status outdated
  // after successful product updates.
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-cache');
  }
  if (!headers.has('Pragma')) {
    headers.set('Pragma', 'no-cache');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      cache: 'no-store',
    });
  } catch {
    throw new Error('Cannot reach backend yet. Start backend on port 3000 and try again.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.message || data.error || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data as T;
}

function uploadFile<T>(path: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return request<T>(path, { method: 'POST', body: form });
}

const json = (body: unknown) => JSON.stringify(body);

export type Role = 'user' | 'store' | 'admin';
export type UserRoleFilter = Role | 'all' | 'non-admin';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: Role;
  avatar?: string;
  profilePicture?: string | null;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: AuthUser;
}

export type StoreStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface Store {
  id: string;
  name: string;
  tagline: string;
  description: string;
  businessPermit: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  website: string;
  facebook: string;
  instagram: string;
  businessHours: string;
  logoUrl: string;
  status: StoreStatus;
  /** Admin's reason when rejected or suspended. */
  statusNote: string;
  reviewedAt: string | null;
  ownerEmail: string;
  ownerName: string;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type StoreProfileInput = Pick<
  Store,
  | 'name' | 'tagline' | 'description' | 'businessPermit' | 'email' | 'phone' | 'address'
  | 'city' | 'website' | 'facebook' | 'instagram' | 'businessHours' | 'logoUrl'
>;

export interface StoreRegistrationInput {
  storeName: string;
  ownerName: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  city: string;
  businessPermit: string;
  description: string;
}

export interface FurnitureItem {
  id: string;
  displayName: string;
  category: string;
  glbUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  depth: number;
  dimensionLabel: string;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  quantity: number;
  availableColors: string[];
  pricePhp?: number;
  styles?: string[];
  rooms?: string[];
  roomTypes?: string[];
  /** Store-controlled: false hides the product from the app. */
  active: boolean;
  sortOrder: number;
  storeId: string | null;
  storeName: string;
  storeStatus: StoreStatus | '';
  /** Admin moderation: taken-down products are hidden from the app. */
  takenDown: boolean;
  takenDownReason: string;
  /** Measured size of the 3D model; AR shows the model at this size. Null when unknown. */
  modelSize?: ModelSize | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Metres: width = X, height = Y, depth = Z of the model. */
export interface ModelSize {
  width: number;
  height: number;
  depth: number;
}

/** What the upload did to a heavy 3D model to make it phone-friendly. */
export interface ModelOptimization {
  fromBytes: number;
  toBytes: number;
  fromVertices: number;
  toVertices: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface AdminStats {
  users: number;
  newUsersThisWeek: number;
  stores: number;
  pendingStores: number;
  furniture: number;
  unassignedProducts: number;
}

export interface StoreStats {
  products: number;
  live: number;
  hidden: number;
  takenDown: number;
  lowStock: number;
  outOfStock: number;
}

export interface ActivityEntry {
  id: string;
  /** Dotted action name, e.g. "store.approved" or "product.created". */
  action: string;
  targetType: 'store' | 'product' | 'user' | 'content';
  targetId: string;
  summary: string;
  actorEmail: string;
  actorRole: string;
  createdAt: string;
}

export interface Faq {
  question: string;
  answer: string;
}

export interface FaqContent {
  faqs: Faq[];
  /** True until an admin saves the FAQs (the app's built-in list is shown). */
  isDefault: boolean;
  updatedAt: string | null;
}

export type LegalKey = 'terms' | 'privacy';

export interface LegalDoc {
  title: string;
  /** Plain text: "## " starts a heading, "• " or "- " a bullet. */
  body: string;
  isDefault: boolean;
  updatedAt: string | null;
}

interface UploadResult {
  success: boolean;
  url: string;
  filename: string;
}

/** Sign-in, store registration, and the signed-in account (admin or store). */
export const api = {
  login(email: string, password: string) {
    return request<LoginResponse>('/users/login', { method: 'POST', body: json({ email, password }) });
  },

  registerStore(input: StoreRegistrationInput) {
    return request<LoginResponse & { store: Store }>('/stores/register', { method: 'POST', body: json(input) });
  },

  getMe() {
    return request<{ success: boolean; user: AuthUser }>('/account/me');
  },

  updateProfile(payload: { name?: string; avatar?: string; profilePicture?: string | null }) {
    return request<{ success: boolean; user: AuthUser }>('/account/profile', { method: 'PATCH', body: json(payload) });
  },

  uploadAvatar(file: File) {
    return uploadFile<UploadResult>('/account/upload/avatar', file);
  },

  /** FAQs as the mobile app shows them. */
  getFaqs() {
    return request<{ success: boolean } & FaqContent>('/content/faqs');
  },

  /** Terms of Service and Privacy Policy as the mobile app shows them. */
  getLegal() {
    return request<{ success: boolean } & Record<LegalKey, LegalDoc>>('/content/legal');
  },
};

/** Admin console: store review, product oversight, users, activity log. */
export const adminApi = {
  getStats() {
    return request<{ success: boolean; stats: AdminStats }>('/admin/stats');
  },

  listStores(status: StoreStatus | 'all' = 'all', search = '') {
    const params = new URLSearchParams({ status });
    if (search) params.set('search', search);
    return request<{ success: boolean; stores: Store[] }>(`/admin/stores?${params}`);
  },

  updateStoreStatus(id: string, status: Exclude<StoreStatus, 'pending'>, note = '') {
    return request<{ success: boolean; store: Store }>(`/admin/stores/${id}/status`, {
      method: 'PATCH',
      body: json({ status, note }),
    });
  },

  /** `store` is a store id, "unassigned", or empty for every product. */
  listFurniture(store = '') {
    const query = store ? `?store=${encodeURIComponent(store)}` : '';
    return request<{ success: boolean; furniture: FurnitureItem[] }>(`/admin/furniture${query}`);
  },

  moderateFurniture(id: string, takenDown: boolean, reason = '') {
    return request<{ success: boolean; furniture: FurnitureItem }>(`/admin/furniture/${id}/moderation`, {
      method: 'PATCH',
      body: json({ takenDown, reason }),
    });
  },

  assignFurnitureStore(id: string, storeId: string) {
    return request<{ success: boolean; furniture: FurnitureItem }>(`/admin/furniture/${id}/store`, {
      method: 'PATCH',
      body: json({ storeId }),
    });
  },

  assignUnassignedFurniture(storeId: string) {
    return request<{ success: boolean; assigned: number }>('/admin/furniture/assign-unassigned', {
      method: 'POST',
      body: json({ storeId }),
    });
  },

  /** 'non-admin' = customers and store owners. */
  listUsers(search = '', role: UserRoleFilter = 'all') {
    const params = new URLSearchParams({ role });
    if (search) params.set('search', search);
    return request<{ success: boolean; users: AdminUser[] }>(`/admin/users?${params}`);
  },

  updateUser(id: string, payload: { name?: string; role?: 'user' | 'admin' }) {
    return request<{ success: boolean; user: AdminUser }>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: json(payload),
    });
  },

  /** Replaces the whole FAQ list, in this order. */
  saveFaqs(faqs: Faq[]) {
    return request<{ success: boolean } & FaqContent>('/admin/content/faqs', { method: 'PUT', body: json({ faqs }) });
  },

  saveLegal(key: LegalKey, body: string) {
    return request<{ success: boolean } & Partial<Record<LegalKey, LegalDoc>>>(`/admin/content/legal/${key}`, {
      method: 'PUT',
      body: json({ body }),
    });
  },

  listActivity(search = '', limit = 100) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (search) params.set('search', search);
    return request<{ success: boolean; activity: ActivityEntry[] }>(`/admin/activity?${params}`);
  },
};

/** Store console: the signed-in store's profile and its own products. */
export const storeApi = {
  getMyStore() {
    return request<{ success: boolean; store: Store }>('/store/me');
  },

  updateMyStore(payload: Partial<StoreProfileInput>) {
    return request<{ success: boolean; store: Store }>('/store/profile', { method: 'PUT', body: json(payload) });
  },

  resubmit() {
    return request<{ success: boolean; store: Store }>('/store/resubmit', { method: 'POST' });
  },

  getStats() {
    return request<{ success: boolean; stats: StoreStats }>('/store/stats');
  },

  listProducts() {
    return request<{ success: boolean; furniture: FurnitureItem[] }>('/store/products');
  },

  createProduct(payload: Partial<FurnitureItem>) {
    return request<{ success: boolean; furniture: FurnitureItem }>('/store/products', {
      method: 'POST',
      body: json(payload),
    });
  },

  updateProduct(id: string, payload: Partial<FurnitureItem>) {
    return request<{ success: boolean; furniture: FurnitureItem }>(`/store/products/${id}`, {
      method: 'PUT',
      body: json(payload),
    });
  },

  deleteProduct(id: string) {
    return request<{ success: boolean; message: string }>(`/store/products/${id}`, { method: 'DELETE' });
  },

  /**
   * Files over 8 MB are optimized for phones before storage, so this can take a minute.
   * `modelSize` is null when the file couldn't be measured; `optimized` is null when the
   * file was stored as uploaded.
   */
  uploadGlb(file: File) {
    return uploadFile<UploadResult & { modelSize: ModelSize | null; optimized: ModelOptimization | null }>(
      '/store/upload/glb',
      file
    );
  },

  /** Product thumbnails and the store logo. */
  uploadImage(file: File) {
    return uploadFile<UploadResult>('/store/upload/image', file);
  },
};
