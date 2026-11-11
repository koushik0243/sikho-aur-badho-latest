export const API_URL = "https://api1.sikhoaurbadho.com";

// User types
export const USER_TYPES = {
  SUPER_ADMIN: 'superadmin',
  CREATOR: 'creator',
  STORE_OWNER: 'organization',
  LEARNER: 'employee',
};

// Dashboard routes per user type
export const DASHBOARD_ROUTES = {
  [USER_TYPES.SUPER_ADMIN]: '/superadmin/dashboard',
  [USER_TYPES.CREATOR]: '/creator/dashboard',
  [USER_TYPES.STORE_OWNER]: '/organization/dashboard',
  [USER_TYPES.LEARNER]: '/learner/dashboard',
};
