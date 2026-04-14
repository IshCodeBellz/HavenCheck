import axios from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const DEFAULT_DEV_PORT = "3001";
const PROD_API_ORIGIN = "https://api.havenflow.com";

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, "");
}

function getExpoHostUri() {
  const expoConfigHost = Constants.expoConfig?.hostUri;
  if (expoConfigHost) return expoConfigHost;

  const manifestHost = (Constants as any)?.manifest2?.extra?.expoClient?.hostUri;
  if (manifestHost) return manifestHost as string;

  return undefined;
}

function resolveApiOrigin() {
  const envOrigin = process.env.EXPO_PUBLIC_API_ORIGIN;
  if (envOrigin) {
    return normalizeOrigin(envOrigin);
  }

  if (!__DEV__) {
    return PROD_API_ORIGIN;
  }

  const expoHostUri = getExpoHostUri();
  const expoHost = expoHostUri?.split(":")[0];
  if (expoHost) {
    const devPort = process.env.EXPO_PUBLIC_API_PORT || DEFAULT_DEV_PORT;
    return `http://${expoHost}:${devPort}`;
  }

  return `http://localhost:${DEFAULT_DEV_PORT}`;
}

const API_ORIGIN = resolveApiOrigin();

/** Legacy routes: `/api/...` */
export const API_BASE_URL = `${API_ORIGIN}/api`;

/** Spec routes: `/api/v1/...` (open shifts, manager/admin carer APIs, etc.) */
export const API_V1_BASE_URL = `${API_ORIGIN}/api/v1`;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

const apiV1 = axios.create({
  baseURL: API_V1_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

function attachAuthInterceptors(client: typeof api) {
  client.interceptors.request.use(
    async (config) => {
      const token = await SecureStore.getItemAsync("authToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        await SecureStore.deleteItemAsync("authToken");
        await SecureStore.deleteItemAsync("user");
      }
      return Promise.reject(error);
    }
  );
}

attachAuthInterceptors(api);
attachAuthInterceptors(apiV1);

export { apiV1 };
export default api;
