/* Who signs an admin access token and who it is for. Shared by the token
   module and the middleware, which cannot import `server-only` code. An
   access token lives fifteen minutes, so renaming these signs everybody in
   again at worst once. */
export const ACCESS_ISSUER = 'claude-engine';
export const ACCESS_AUDIENCE = 'claude-engine-admin';
