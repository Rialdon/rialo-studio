"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { getWallets } from "@wallet-standard/core";

const CHAIN = "rialo:testnet";
const STORE = "https://chromewebstore.google.com/detail/rialo-wallet/dbmgekigjgnahdnfgfpdognodiegpmcg";

type WalletCtx = {
  installed: boolean;
  isConnected: boolean;
  address: string | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signAndSend: (tx: Uint8Array) => Promise<any>;
  signAndSendMany: (txs: Uint8Array[]) => Promise<any[]>;
};

const Ctx = createContext<WalletCtx | null>(null);
export function useRialoWallet(): WalletCtx {
  return useContext(Ctx) as WalletCtx;
}

export function Providers({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<any>(null);
  const [account, setAccount] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const connectingRef = useRef(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    const api = getWallets();
    const find = () => api.get().find((w: any) => /rialo/i.test(w.name)) || null;
    setWallet(find());
    const off = api.on("register", () => setWallet(find()));
    return () => off();
  }, []);

  useEffect(() => {
    const events = wallet?.features?.["standard:events"];
    if (!events) return;
    return events.on("change", ({ accounts }: any) => {
      if (accounts) setAccount(accounts[0] ?? null);
    });
  }, [wallet]);

  // Connect dengan percobaan ulang otomatis (ekstensi yang terkunci)
  const connect = useCallback(async () => {
    if (!wallet) {
      window.open(STORE, "_blank");
      return;
    }
    if (connectingRef.current) {
      cancelRef.current = true;
      return;
    }
    connectingRef.current = true;
    cancelRef.current = false;
    setError(null);

    let connected = false;
    let lastError: string | null = null;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const delays = [1500, 2500, 4000, 6000, 8000];
    const deadline = Date.now() + 75000;

    try {
      for (let i = 0; !connected && !cancelRef.current && Date.now() < deadline; i++) {
        const attempt = wallet.features["standard:connect"].connect();
        attempt
          .then((res: any) => {
            if (!connected && res?.accounts?.length) {
              connected = true;
              setAccount(res.accounts[0]);
            }
          })
          .catch(() => {});
        try {
          const res: any = await Promise.race([
            attempt,
            new Promise((_, rej) => setTimeout(() => rej(new Error("__timeout")), 10000)),
          ]);
          if (res?.accounts?.length) {
            connected = true;
            setAccount(res.accounts[0]);
            break;
          }
          lastError = "No account returned";
          break;
        } catch (e: any) {
          const msg = String(e?.message || e);
          if (/reject|denied|declin|cancel|refus/i.test(msg)) {
            lastError = msg;
            break;
          }
          await wait(delays[Math.min(i, delays.length - 1)]);
        }
      }
      if (!connected && !cancelRef.current && !lastError) {
        lastError = "Wallet did not respond. Unlock it, then press Connect again.";
      }
      if (!connected && lastError) setError(lastError);
    } finally {
      connectingRef.current = false;
      cancelRef.current = false;
    }
  }, [wallet]);

  const disconnect = useCallback(async () => {
    try {
      await wallet?.features?.["standard:disconnect"]?.disconnect();
    } finally {
      setAccount(null);
    }
  }, [wallet]);

  const signAndSend = useCallback(
    async (txBytes: Uint8Array) => {
      const feature = wallet?.features?.["rialo:signAndSendTransaction"];
      if (!feature || !account) throw new Error("Wallet is not connected");
      return feature.signAndSendTransaction({ account, transaction: txBytes, chain: CHAIN });
    },
    [wallet, account]
  );

  const signAndSendMany = useCallback(
    async (txs: Uint8Array[]) => {
      const feature = wallet?.features?.["rialo:signAndSendTransaction"];
      if (!feature || !account) throw new Error("Wallet is not connected");
      const one = (t: Uint8Array) => feature.signAndSendTransaction({ account, transaction: t, chain: CHAIN });
      let done: any[] = [];
      if (txs.length > 1) {
        try {
          const out = await feature.signAndSendTransaction(
            ...txs.map((t) => ({ account, transaction: t, chain: CHAIN }))
          );
          done = Array.isArray(out) ? out : [out];
        } catch (e: any) {
          if (/reject|denied|declin|cancel|refus/i.test(String(e?.message || e))) throw e;
        }
      }
      for (let i = done.length; i < txs.length; i++) done.push(await one(txs[i]));
      return done;
    },
    [wallet, account]
  );

  const value: WalletCtx = {
    installed: !!wallet,
    isConnected: !!account,
    address: account?.address ?? null,
    error,
    connect,
    disconnect,
    signAndSend,
    signAndSendMany,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
