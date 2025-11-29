declare module 'intuit-oauth' {
  class OAuthClient {
    constructor(config: {
      clientId: string;
      clientSecret: string;
      environment: 'sandbox' | 'production';
      redirectUri: string;
    });

    static scopes: {
      Accounting: string;
      Payment: string;
      OpenId: string;
      Profile: string;
      Email: string;
      Phone: string;
      Address: string;
    };

    authorizeUri(options: { scope: string[]; state?: string }): string;

    createToken(url: string): Promise<AuthResponse>;
    refresh(): Promise<AuthResponse>;
    refreshUsingToken(refresh_token: string): Promise<AuthResponse>;
    isAccessTokenValid(): boolean;
    getToken(): TokenData | null;
  }

  export interface AuthResponse {
    getJson(): TokenData;
    getToken(): TokenData;
  }

  export interface TokenData {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    realmId?: string;
    x_refresh_token_expires_in?: number;
  }

  export default OAuthClient;

  export { OAuthClient };
}
