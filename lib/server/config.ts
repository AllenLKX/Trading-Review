export type ServerRuntimeConfig = {
  appVersion: string;
  nodeEnv: string;
  database: {
    configured: boolean;
    singleUserConfigured: boolean;
  };
  access: {
    configured: boolean;
    publicOrigin?: string;
  };
  ai: {
    configured: boolean;
    provider: "deepseek";
    model: string;
  };
  cos: {
    configured: boolean;
    bucketConfigured: boolean;
    regionConfigured: boolean;
  };
};

export function readServerRuntimeConfig(): ServerRuntimeConfig {
  const cosBucketConfigured = Boolean(process.env.TENCENT_COS_BUCKET);
  const cosRegionConfigured = Boolean(process.env.TENCENT_COS_REGION);

  return {
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "local-dev",
    nodeEnv: process.env.NODE_ENV ?? "development",
    database: {
      configured: Boolean(process.env.DATABASE_URL),
      singleUserConfigured: Boolean(process.env.RATIONALTRADE_SINGLE_USER_ID)
    },
    access: {
      configured: Boolean(process.env.APP_ACCESS_USERNAME && process.env.APP_ACCESS_PASSWORD),
      publicOrigin: process.env.APP_PUBLIC_ORIGIN
    },
    ai: {
      configured: Boolean(process.env.DEEPSEEK_API_KEY ?? process.env.AI_API_KEY),
      provider: "deepseek",
      model: process.env.AI_MODEL ?? "deepseek-v4-flash"
    },
    cos: {
      configured: Boolean(
        process.env.TENCENT_COS_SECRET_ID &&
          process.env.TENCENT_COS_SECRET_KEY &&
          cosBucketConfigured &&
          cosRegionConfigured
      ),
      bucketConfigured: cosBucketConfigured,
      regionConfigured: cosRegionConfigured
    }
  };
}
