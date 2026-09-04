import { loadWebEnv } from "@pl/config";

/** Validated NEXT_PUBLIC_* configuration. Throws at build/start if invalid. */
export const env = loadWebEnv();
