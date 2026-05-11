import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    // {
    //   auth: {
    //     storage: {
    //       getItem: () => {
    //         return Promise.resolve(localStorage.get("supabase_session"));
    //       },
    //       setItem: (key: string, value: string) => {
    //         return Promise.resolve(localStorage.set("supabase_session", value));
    //       },
    //       removeItem: (key: string) => {},
    //     },
    //   },
    // }
  );
}

import { decode } from "jsonwebtoken";

async function hi() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (accessToken) {
    const claims = decode(accessToken);
    console.log("CLAIMS", claims);
  }
}

hi();
