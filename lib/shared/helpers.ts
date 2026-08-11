import { uuidv4 } from "./uuid";

/** Random id for mock/local-only records. Secure-context safe — see uuid.ts. */
export const id = (): string => uuidv4();
