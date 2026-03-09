import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            // 'cookieStore' here is a ReadonlyRequestCookies, which does not have the 'set' method.
            // To set cookies in a Server Action (or handler), you should use the cookies() function again directly
            // because cookies() in Next.js returns a mutable ResponseCookies in action/request handler/server func,
            // otherwise it is a ReadonlyRequestCookies.
            //
            // Here's how you can set each cookie:
            cookiesToSet.forEach(async ({ name, value, options }) => {
              (await cookies()).set(name, value, options);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have proxy refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
