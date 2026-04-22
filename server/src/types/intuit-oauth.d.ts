declare module 'intuit-oauth' {
  interface IntuitToken {
    access_token?: string;
    refresh_token?: string;
    realmId?: string;
    [key: string]: unknown;
  }
  interface OAuthClientInstance {
    authorizeUri(options: { scope: string[]; state?: string }): string;
    getToken(): IntuitToken;
    createToken(uri: string): Promise<{ getJson(): IntuitToken }>;
    setToken(token: IntuitToken): void;
    refresh(): Promise<unknown>;
    revoke(): Promise<unknown>;
  }
  interface OAuthClientConstructor {
    new (config: {
      clientId: string;
      clientSecret: string;
      environment?: 'sandbox' | 'production';
      redirectUri?: string;
    }): OAuthClientInstance;
    scopes: {
      Accounting: string;
      OpenId: string;
      Profile: string;
      Email: string;
    };
  }
  const OAuthClient: OAuthClientConstructor;
  export default OAuthClient;
}
