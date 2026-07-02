import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

// 게이트웨이(동일 오리진) /api 로 모든 요청 전송
export const api = axios.create({ baseURL: "/api" });

const ACCESS_KEY = "lm_access";
const REFRESH_KEY = "lm_refresh";

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY) || "";
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY) || "";
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh !== undefined) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  const t = tokenStore.access;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// 401 시 refresh 1회 자동 재발급
let refreshing: Promise<string> | null = null;
api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const isAuthCall = original?.url?.includes("/members/login") || original?.url?.includes("/members/refresh");
    if (status === 401 && !original._retry && !isAuthCall && tokenStore.refresh) {
      original._retry = true;
      try {
        if (!refreshing) {
          refreshing = axios
            .post("/api/members/refresh", { refresh: tokenStore.refresh })
            .then((res) => {
              tokenStore.set(res.data.access);
              return res.data.access as string;
            })
            .finally(() => {
              refreshing = null;
            });
        }
        const newAccess = await refreshing;
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch {
        tokenStore.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function apiError(e: unknown): string {
  const ax = e as AxiosError<{ detail?: any }>;
  const d = ax.response?.data?.detail;
  if (Array.isArray(d)) {
    // pydantic 422 검증오류: [{loc,msg,...}] → 읽기 쉬운 문구로
    return d.map((x: any) => {
      const f = Array.isArray(x?.loc) ? x.loc.filter((p: any) => p !== "body").join(".") : "";
      return (f ? `${f}: ` : "") + (x?.msg || "");
    }).join("; ") || "입력값 검증 오류";
  }
  if (d && typeof d === "object") return JSON.stringify(d);
  return d || ax.message || "요청 처리 중 오류가 발생했습니다";
}
