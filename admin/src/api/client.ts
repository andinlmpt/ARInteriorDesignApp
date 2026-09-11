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

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
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

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: 'user' | 'admin';
  avatar?: string;
  profilePicture?: string | null;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: AuthUser;
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
  active: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface StoreInfo {
  storeName: string;
  tagline: string;
  description: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  website: string;
  facebook: string;
  instagram: string;
  businessHours: string;
  logoUrl: string;
  updatedAt?: string;
}

export const api = {
  login(email: string, password: string) {
    return request<LoginResponse>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  getMe() {
    return request<{ success: boolean; user: AuthUser }>('/admin/me');
  },

  updateProfile(payload: { name?: string; avatar?: string; profilePicture?: string | null }) {
    return request<{ success: boolean; user: AuthUser }>('/admin/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  uploadAvatar(file: File) {
    const form = new FormData();
    form.append('file', file);
    return request<{ success: boolean; url: string; filename: string }>('/admin/upload/avatar', {
      method: 'POST',
      body: form,
    });
  },

  getStats() {
    return request<{ success: boolean; stats: { users: number; furniture: number; activeFurniture: number } }>(
      '/admin/stats'
    );
  },

  listFurniture(includeInactive = true) {
    const query = includeInactive ? '?includeInactive=true' : '';
    return request<{ success: boolean; furniture: FurnitureItem[] }>(`/admin/furniture${query}`);
  },

  createFurniture(payload: Partial<FurnitureItem>) {
    return request<{ success: boolean; furniture: FurnitureItem }>('/admin/furniture', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateFurniture(id: string, payload: Partial<FurnitureItem>) {
    return request<{ success: boolean; furniture: FurnitureItem }>(`/admin/furniture/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteFurniture(id: string, hard = false) {
    return request<{ success: boolean; message: string }>(
      `/admin/furniture/${id}${hard ? '?hard=true' : ''}`,
      { method: 'DELETE' }
    );
  },

  uploadGlb(file: File) {
    const form = new FormData();
    form.append('file', file);
    return request<{ success: boolean; url: string; filename: string }>('/admin/upload/glb', {
      method: 'POST',
      body: form,
    });
  },

  uploadThumbnail(file: File) {
    const form = new FormData();
    form.append('file', file);
    return request<{ success: boolean; url: string; filename: string }>('/admin/upload/thumbnail', {
      method: 'POST',
      body: form,
    });
  },

  listUsers(search = '') {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<{ success: boolean; users: AdminUser[] }>(`/admin/users${query}`);
  },

  updateUser(id: string, payload: { name?: string; role?: 'user' | 'admin' }) {
    return request<{ success: boolean; user: AdminUser }>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  getStore() {
    return request<{ success: boolean; store: StoreInfo }>('/admin/store');
  },

  updateStore(payload: Partial<StoreInfo>) {
    return request<{ success: boolean; store: StoreInfo }>('/admin/store', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};
