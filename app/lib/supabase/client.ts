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
