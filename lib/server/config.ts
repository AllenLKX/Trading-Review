export type ServerRuntimeConfig = {
  appVersion: string;
  nodeEnv: string;
  database: {
    configured: boolean;
    singleUserConfigured: boolean;
  };
  ai: {
    configured: boolean;
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
    ai: {
      configured: Boolean(process.env.AI_API_KEY)
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
