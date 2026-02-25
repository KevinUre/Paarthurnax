export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";

export const AUTH_ACCESS_TOKEN_KEY = "paarthurnax_access_token";
export const AUTH_REFRESH_TOKEN_KEY = "paarthurnax_refresh_token";

export function getAccessToken() {
  return localStorage.getItem(AUTH_ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
}

export function setAuthTokens(accessToken, refreshToken) {
  localStorage.setItem(AUTH_ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshToken);
}

export function clearAuthTokens() {
  localStorage.removeItem(AUTH_ACCESS_TOKEN_KEY);
  localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
}

let refreshPromise = null;

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : null;
  return { payload, status: response.status, ok: response.ok };
}

async function requestOnce(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const { payload, status, ok } = await parseResponse(response);
  if (!ok) {
    const message = payload?.error || `Request failed with ${status}`;
    const error = new Error(message);
    error.status = status;
    throw error;
  }
  return payload;
}

async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw Object.assign(new Error("Not authenticated"), { status: 401 });
  }

  refreshPromise = requestOnce("/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
    .then((result) => {
      setAuthTokens(result.accessToken, result.refreshToken);
      return result;
    })
    .catch((error) => {
      clearAuthTokens();
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function apiRequest(path, options = {}) {
  const { requireAuth = false, ...fetchOptions } = options;
  const headers = { ...(fetchOptions.headers || {}) };

  if (requireAuth) {
    const accessToken = getAccessToken();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  try {
    return await requestOnce(path, { ...fetchOptions, headers });
  } catch (error) {
    if (!(requireAuth && error.status === 401)) {
      throw error;
    }

    await refreshAccessToken();

    const retryHeaders = { ...(fetchOptions.headers || {}) };
    const nextAccessToken = getAccessToken();
    if (nextAccessToken) {
      retryHeaders.Authorization = `Bearer ${nextAccessToken}`;
    }

    return requestOnce(path, { ...fetchOptions, headers: retryHeaders });
  }
}
