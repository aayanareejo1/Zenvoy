// Sensitive values are supplied as EXPO_PUBLIC_* environment variables.
// EAS Build: set via `eas env:create` (already configured for preview + production).
// Local dev: create a .env.local file with these keys (never commit it).

export const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY;
export const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
export const FREE_MONTHLY_LIMIT = 5;
export const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
export const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
export const RC_ENTITLEMENT_ID = 'Zenvoy Pro';
