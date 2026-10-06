// Google Identity Services (GIS) — libreria ufficiale Google per OAuth nel
// browser, caricata dinamicamente da accounts.google.com. Non è nei tipi
// standard del DOM, va dichiarata a mano.

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

export interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

export interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type: string; message?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient;
          revoke: (accessToken: string, callback?: () => void) => void;
        };
      };
    };
  }
}
