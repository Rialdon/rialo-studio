let cached: Promise<{ cdk: any; client: any }> | null = null;

// Memuat @rialo/ts-cdk hanya di browser, saat dibutuhkan
export function loadCdk(): Promise<{ cdk: any; client: any }> {
  if (!cached) {
    cached = import("@rialo/ts-cdk").then((cdk: any) => ({
      cdk,
      client: cdk.createRialoClient(cdk.getDefaultRialoClientConfig("testnet")),
    }));
  }
  return cached;
}
