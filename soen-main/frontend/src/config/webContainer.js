import { WebContainer } from "@webcontainer/api";

const WC_KEY = "__webcontainer_instance__"; // Just a name to store instance globally

export const getWebContainer = async () => {
  // If WebContainer already booted or booting, reuse it
  if (globalThis[WC_KEY]) {
    return globalThis[WC_KEY];
  }

  // Boot it once and store the promise
  const instancePromise = WebContainer.boot();
  globalThis[WC_KEY] = instancePromise;

  const instance = await instancePromise;
  console.log("🚀 WebContainer booted");

  return instance;
};
