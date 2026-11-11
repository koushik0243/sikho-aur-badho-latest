import axios from 'axios';
import { API_URL } from '../lib/constant';
import { forceLogout } from '../utils/authSession';
import { trackPageRequest } from '../lib/pageLoader';

const GET_CACHE_TTL_MS = 60 * 1000;
const getResponseCache = new Map();
const pendingGetRequests = new Map();

const getTokenFromStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const adminToken = localStorage.getItem('adminToken');
  const userToken = localStorage.getItem('BHARAT_TOKEN');
  const rawToken = adminToken || userToken;

  if (!rawToken || rawToken === 'undefined' || rawToken === 'null') {
    return null;
  }

  const normalizedToken = String(rawToken).trim().replace(/^"|"$/g, '');
  if (!normalizedToken) {
    return null;
  }

  return normalizedToken.startsWith('Bearer ')
    ? normalizedToken.slice(7).trim()
    : normalizedToken;
};

// GETs made while a page is opening keep the full-page loader up until they finish.
// options.onUploadProgress(percent 0–100) — POST/PUT only, e.g. a large video upload.
async function apiServiceHandler(method, endpoint, payload, options = {}) {
  if (String(method || '').toUpperCase() !== 'GET') return sendRequest(method, endpoint, payload, options);
  const done = trackPageRequest();
  try {
    return await sendRequest(method, endpoint, payload);
  } finally {
    done();
  }
}

async function sendRequest(method, endpoint, payload, options = {}) {
  const token = getTokenFromStorage();
  const onUploadProgress = typeof options.onUploadProgress === 'function'
    ? (e) => { if (e.total) options.onUploadProgress(Math.round((e.loaded / e.total) * 100)); }
    : undefined;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const normalizedMethod = String(method || '').toUpperCase();
  const requestUrl = `${API_URL}/${endpoint}`;
  const cacheKey = `${token || 'anonymous'}::${requestUrl}`;

  try {
    let response;
    if (normalizedMethod === 'GET') {
      // Delete-via-GET endpoints must never be cached; always clear list cache afterward
      if (requestUrl.includes('/delete/')) {
        try {
          const axiosResponse = await axios({ method: 'get', url: requestUrl, headers });
          return axiosResponse.data;
        } finally {
          getResponseCache.clear();
          pendingGetRequests.clear();
        }
      }

      const cachedEntry = getResponseCache.get(cacheKey);
      if (cachedEntry && Date.now() - cachedEntry.timestamp < GET_CACHE_TTL_MS) {
        return cachedEntry.data;
      }

      const pendingRequest = pendingGetRequests.get(cacheKey);
      if (pendingRequest) {
        return pendingRequest;
      }

      const requestPromise = axios({
        method: 'get',
        url: requestUrl,
        headers
      })
        .then((axiosResponse) => {
          const responseData = axiosResponse.data;
          getResponseCache.set(cacheKey, {
            data: responseData,
            timestamp: Date.now(),
          });
          return responseData;
        })
        .finally(() => {
          pendingGetRequests.delete(cacheKey);
        });

      pendingGetRequests.set(cacheKey, requestPromise);
      return requestPromise;

    } else if (normalizedMethod === 'POST') {

      response = await axios({
        method: 'post',
        url: requestUrl,
        headers,
        data: payload,
        onUploadProgress
      });
      getResponseCache.clear();

    } else if (normalizedMethod === 'PUT') {
      
      response = await axios({
        method: 'put',
        url: requestUrl,
        headers,
        data: payload,
        onUploadProgress
      });
      getResponseCache.clear();

    }
    else if (normalizedMethod === 'DELETE') {

      response = await axios({
        method: 'delete',
        url: requestUrl,
        headers,
        data: payload
      });
      getResponseCache.clear();

    }
    else {
      throw new Error('Unsupported HTTP method');
    }

    return response.data;
  } catch (error) {
    // A 401 only ever comes back from the JWT `protect` middleware (missing/invalid/
    // expired token) — login failures return 400. If we WERE sending a token and the
    // server rejected it, the session is dead server-side: force a clean logout
    // instead of letting the page silently render with no data.
    if (token && error?.response?.status === 401) {
      forceLogout();
    }

    const getErrorMessage = (err) => {
      const responseData = err?.response?.data;
      const statusCode = err?.response?.status;

      if (typeof responseData === 'string' && responseData.trim()) {
        return responseData;
      }

      if (Array.isArray(responseData?.message) && responseData.message.length) {
        return responseData.message.join(', ');
      }

      if (typeof responseData?.message === 'string' && responseData.message.trim()) {
        return responseData.message;
      }

      if (typeof responseData?.error === 'string' && responseData.error.trim()) {
        return responseData.error;
      }

      if (statusCode) {
        return `Request failed (${statusCode}).`;
      }

      return err?.message || 'An error occurred';
    };

    // Extract and throw a proper error message
    if (error.response) {
      const wrappedError = new Error(getErrorMessage(error));
      wrappedError.statusCode = error.response?.status;
      throw wrappedError;
    } else if (error.request) {
      // Request made but no response
      throw new Error('No response from server. Please check your connection.');
    } else {
      // Something else happened
      const wrappedError = new Error(getErrorMessage(error));
      wrappedError.statusCode = error?.statusCode;
      throw wrappedError;
    }
  }
}

export function clearGetCache() {
  getResponseCache.clear();
  pendingGetRequests.clear();
}

export default apiServiceHandler;

/** The signed-in user's bearer token (for requests apiServiceHandler can't make: uploads with progress, file blobs). */
export const getAuthToken = getTokenFromStorage;
