import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiServiceHandler from '../../service/apiService';
import { markSessionAlive, isSessionExpired, clearStoredSession } from '../../utils/authSession';

// ---------------------------------------------------------------------------
// User type → dashboard route mapping
// ---------------------------------------------------------------------------
export const USER_TYPE_ROUTES = {
  superadmin: '/superadmin/dashboard',
  creator: '/creator/dashboard',
  organization: '/storeowner/dashboard',
  employee: '/learner/dashboard',
};

// ---------------------------------------------------------------------------
// Async Thunks
// ---------------------------------------------------------------------------

/** Step 1 – Login with phone/email + password */
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ identifier, password }, { rejectWithValue }) => {
    try {
      const data = await apiServiceHandler('POST', 'user/admin/login', {
        identifier,
        password,
      });
      return data;
    } catch (err) {
      return rejectWithValue(err?.message || 'Login failed. Please try again.');
    }
  }
);

/** Step 2 – Verify OTP */
export const verifyOtp = createAsyncThunk(
  'auth/verifyOtp',
  async ({ otp, identifier }, { rejectWithValue }) => {
    try {
      const data = await apiServiceHandler('POST', 'user/verify-otp', {
        otp,
        identifier,
      });
      return data;
    } catch (err) {
      return rejectWithValue(err?.message || 'Invalid OTP. Please try again.');
    }
  }
);

/** Resend OTP */
export const resendOtp = createAsyncThunk(
  'auth/resendOtp',
  async ({ identifier }, { rejectWithValue }) => {
    try {
      const data = await apiServiceHandler('POST', 'user/resend-otp', {
        identifier,
      });
      return data;
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to resend OTP.');
    }
  }
);

/** Forgot password – send reset link */
export const forgotPassword = createAsyncThunk(
  'auth/forgotPassword',
  async ({ identifier }, { rejectWithValue }) => {
    try {
      const data = await apiServiceHandler('POST', 'user/forgot-password', {
        email: identifier,
      });
      return { data, identifier };
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to send reset link.');
    }
  }
);

/** Set / reset new password (via reset token) */
export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async ({ token, newPassword, confirmPassword }, { rejectWithValue }) => {
    try {
      const data = await apiServiceHandler('POST', 'user/reset-password', {
        token,
        newPassword,
        confirmPassword,
      });
      return data;
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to update password.');
    }
  }
);

/** Welcome screen – activate account (admin-created user sets password) */
export const activateAccount = createAsyncThunk(
  'auth/activateAccount',
  async ({ token, newPassword, confirmPassword }, { rejectWithValue }) => {
    try {
      const data = await apiServiceHandler('POST', 'user/activate-account', {
        token,
        newPassword,
        confirmPassword,
      });
      return data;
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to activate account.');
    }
  }
);

/** Logout */
export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      await apiServiceHandler('POST', 'user/logout', {});
    } catch {
      // logout should always clear local state regardless of API response
    }
  }
);

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------
const initialState = {
  // ── Persisted auth data ─────────────────────────────────────────────────
  user: null,
  token: null,
  userType: null,
  isAuthenticated: false,
  authReady: false,   // true after rehydrateAuth has run (even if nothing was found)

  // ── Auth screen flow ────────────────────────────────────────────────────
  // Values: 'login' | 'otp' | 'forgotPassword' | 'resetLinkSent' | 'setNewPassword' | 'welcome'
  authView: 'login',

  // ── OTP state ───────────────────────────────────────────────────────────
  otpIdentifier: null,

  // ── Forgot-password state ───────────────────────────────────────────────
  resetIdentifier: null,
  resetToken: null,

  // ── Welcome screen (admin-created account) ──────────────────────────────
  welcomeData: null,

  // ── UI feedback ─────────────────────────────────────────────────────────
  loading: false,
  error: null,
  loginAttempts: 0,
  maxLoginAttempts: 5,
};

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthView(state, action) {
      state.authView = action.payload;
      state.error = null;
    },

    setWelcomeData(state, action) {
      state.welcomeData = action.payload;
      state.authView = 'welcome';
    },

    setResetToken(state, action) {
      state.resetToken = action.payload;
      state.authView = 'setNewPassword';
    },

    clearError(state) {
      state.error = null;
    },

    clearAuth(state) {
      Object.assign(state, initialState);
    },

    rehydrateAuth(state) {
      state.authReady = true; // Always mark ready, even when nothing is found
      if (typeof window === 'undefined') return;
      try {
        const token    = localStorage.getItem('adminToken') || localStorage.getItem('BHARAT_TOKEN');
        const userRaw  = localStorage.getItem('authUser');
        const userType = localStorage.getItem('authUserType');
        if (!token || !userRaw) return;

        // The stored token belongs to a previous session that's since gone stale —
        // either the tab/browser was closed and reopened, or it's been idle past the
        // 30-minute timeout (e.g. left open overnight). Treat it as logged out rather
        // than rehydrating a session the server would reject anyway.
        if (isSessionExpired()) {
          clearStoredSession();
          return;
        }

        state.user            = JSON.parse(userRaw);
        state.token           = token;
        state.userType        = userType || null;
        state.isAuthenticated = true;
      } catch {
        // Malformed localStorage data — leave state as-is
      }
    },
  },

  extraReducers: (builder) => {
    // ── loginUser ──────────────────────────────────────────────────────────
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        // apiService returns response.data directly — action.payload IS the response body
        const res = action.payload;

        if (res?.requiresOtp) {
          state.otpIdentifier = action.meta.arg.identifier;
          state.authView = 'otp';
          return;
        }

        if (res?.isNewAccount) {
          state.welcomeData = {
            name: res.name,
            store: res.store,
            role: res.role,
            plan: res.plan,
            activationToken: res.activationToken,
          };
          state.authView = 'welcome';
          return;
        }

        // API returns a flat object: { _id, name, email, user_type, secret, ... }
        // (no nested user object; token field is called 'secret')
        const flat = res?.data ?? res;
        const userObj = flat?.user ?? flat;
        const tokenValue = flat?.token || flat?.secret || flat?.user?.token || flat?.user?.secret;
        const userType = userObj?.user_type || userObj?.userType || userObj?.role;

        state.user = userObj;
        state.token = tokenValue;
        state.userType = userType;
        state.isAuthenticated = true;
        state.authReady = true;
        state.loginAttempts = 0;

        if (typeof window !== 'undefined') {
          localStorage.setItem('adminToken', tokenValue);
          localStorage.setItem('authUser', JSON.stringify(userObj));
          localStorage.setItem('authUserType', userType || '');
          markSessionAlive();
        }
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.loginAttempts += 1;
      });

    // ── verifyOtp ──────────────────────────────────────────────────────────
    builder
      .addCase(verifyOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.loading = false;
        const res = action.payload;
        const flat = res?.data ?? res;
        const userObj = flat?.user ?? flat;
        const tokenValue = flat?.token || flat?.secret || flat?.user?.token || flat?.user?.secret;
        const userType = userObj?.user_type || userObj?.userType || userObj?.role;

        state.user = userObj;
        state.token = tokenValue;
        state.userType = userType;
        state.isAuthenticated = true;
        state.authReady = true;
        state.loginAttempts = 0;
        state.otpIdentifier = null;

        if (typeof window !== 'undefined') {
          localStorage.setItem('adminToken', tokenValue);
          localStorage.setItem('authUser', JSON.stringify(userObj));
          localStorage.setItem('authUserType', userType || '');
          markSessionAlive();
        }
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // ── resendOtp ──────────────────────────────────────────────────────────
    builder
      .addCase(resendOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resendOtp.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(resendOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // ── forgotPassword ─────────────────────────────────────────────────────
    builder
      .addCase(forgotPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(forgotPassword.fulfilled, (state, action) => {
        state.loading = false;
        state.resetIdentifier = action.payload.identifier;
        state.authView = 'resetLinkSent';
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // ── resetPassword ──────────────────────────────────────────────────────
    builder
      .addCase(resetPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.loading = false;
        state.authView = 'login';
        state.resetIdentifier = null;
        state.resetToken = null;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // ── activateAccount ────────────────────────────────────────────────────
    builder
      .addCase(activateAccount.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(activateAccount.fulfilled, (state, action) => {
        state.loading = false;
        const res = action.payload;
        const flat = res?.data ?? res;
        const userObj = flat?.user ?? flat;
        const tokenValue = flat?.token || flat?.secret || flat?.user?.token || flat?.user?.secret;
        const userType = userObj?.user_type || userObj?.userType || userObj?.role;

        state.user = userObj;
        state.token = tokenValue;
        state.userType = userType;
        state.isAuthenticated = true;
        state.authReady = true;
        state.welcomeData = null;

        if (typeof window !== 'undefined') {
          localStorage.setItem('adminToken', tokenValue);
          localStorage.setItem('authUser', JSON.stringify(userObj));
          localStorage.setItem('authUserType', userType || '');
          markSessionAlive();
        }
      })
      .addCase(activateAccount.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // ── logoutUser ─────────────────────────────────────────────────────────
    builder.addCase(logoutUser.fulfilled, (state) => {
      clearStoredSession();
      Object.assign(state, initialState);
    });
  },
});

// ---------------------------------------------------------------------------
// Actions & Selectors
// ---------------------------------------------------------------------------
export const { setAuthView, setWelcomeData, setResetToken, clearError, clearAuth, rehydrateAuth } =
  authSlice.actions;

export const selectAuth = (state) => state.auth;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectAuthReady = (state) => state.auth.authReady;
export const selectUser = (state) => state.auth.user;
export const selectUserType = (state) => state.auth.userType;
export const selectToken = (state) => state.auth.token;
export const selectAuthView = (state) => state.auth.authView;
export const selectAuthLoading = (state) => state.auth.loading;
export const selectAuthError = (state) => state.auth.error;
export const selectLoginAttempts = (state) => state.auth.loginAttempts;
export const selectMaxLoginAttempts = (state) => state.auth.maxLoginAttempts;
export const selectOtpIdentifier = (state) => state.auth.otpIdentifier;
export const selectResetIdentifier = (state) => state.auth.resetIdentifier;
export const selectWelcomeData = (state) => state.auth.welcomeData;
export const selectDashboardRoute = (state) =>
  USER_TYPE_ROUTES[state.auth.userType] ?? '/login';

export default authSlice.reducer;
