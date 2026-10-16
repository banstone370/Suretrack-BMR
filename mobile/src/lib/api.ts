import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'suretech_a…oken';
const REFRESH_KEY = 'suretech_r…oken';
const ORIGIN_STORAGE_KEY = 'suretech_api_origin';

export const DEFAULT_API_ORIGIN =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

let cachedOrigin: string | null = null;

export async function getApiOrigin(): Promise<string> {
  if (cachedOrigin) return cachedOrigin;
  const stored = await AsyncStorage.getItem(ORIGIN_STORAGE_KEY);
  const resolved = (stored ?? DEFAULT_API_ORIGIN).replace(/\/$/, '');
  cachedOrigin = resolved;
  return resolved;
}

export async function setApiOrigin(origin: string) {
  cachedOrigin = origin.replace(/\/$/, '');
  await AsyncStorage.setItem(ORIGIN_STORAGE_KEY, cachedOrigin);
}

export const apiBase = () => `${cachedOrigin ?? DEFAULT_API_ORIGIN}/api/v1`;

export const tokenStore = {
  async getAccess() {
    return SecureStore.getItemAsync(ACCESS_KEY);
  },
  async getRefresh() {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },
  async set(access: string, refresh: string) {
    await SecureStore.setItemAsync(ACCESS_KEY, access);
    await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  },
  async clear() {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};

export const api = axios.create({ headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use(async (config) => {
  config.baseURL = `${await getApiOrigin()}/api/v1`;
  const token = await tokenStore.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refresh = await tokenStore.getRefresh();
  if (!refresh) return null;
  try {
    const origin = await getApiOrigin();
    const { data } = await axios.post(`${origin}/api/v1/auth/refresh`, {
      refreshToken: refresh,
    });
    await tokenStore.set(data.data.accessToken, data.data.refreshToken);
    return data.data.accessToken as string;
  } catch {
    await tokenStore.clear();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as
      | (typeof error.config & { _retry?: boolean; _auth?: boolean })
      | undefined;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes('/auth/')
    ) {
      original._retry = true;
      refreshing = refreshing ?? doRefresh();
      const token = await refreshing;
      refreshing = null;
      if (token) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${token}`;
        return api(original);
      }
      // force sign-out; AuthContext listens for this event
      (globalThis as unknown as { __suretechSignedOut?: () => void }).__suretechSignedOut?.();
    }
    return Promise.reject(error);
  },
);

/** Extract the server error message: { error: { code, message } } */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const e = err as AxiosError<{ error?: { message?: string }; message?: string }>;
  return (
    e?.response?.data?.error?.message ?? e?.message ?? (typeof err === 'string' ? err : fallback)
  );
}

/** Unwrap the { success, data, meta } envelope */
export function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data;
}

export async function downloadPdf(batchId: string, batchNo: string): Promise<string> {
  const token = await tokenStore.getAccess();
  const origin = await getApiOrigin();
  const res = await axios.get(`${origin}/api/v1/batches/${batchId}/pdf`, {
    responseType: 'arraybuffer',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const base64 = arrayBufferToBase64(res.data as ArrayBuffer);
  void batchNo;
  return `data:application/pdf;base64,${base64}`;
}

function arrayBufferToBase64Fn(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export const arrayBufferToBase64 = arrayBufferToBase64Fn;

export async function downloadBlob(urlPath: string): Promise<ArrayBuffer> {
  const origin = await getApiOrigin();
  const token = await tokenStore.getAccess();
  const res = await axios.get(`${origin}${urlPath}`, {
    responseType: 'arraybuffer',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.data as ArrayBuffer;
}
