import { createAuthClient } from "better-auth/react";

// Same-origin client: works from localhost and from a phone on the LAN.
export const authClient = createAuthClient();
