import { NextRequest } from "next/server";
import {
  createSupabaseServer,
  createSupabaseSSRClient,
} from "@/app/lib/supabase/server"; // use the SSR server client
import { createClient } from "@/app/lib/supabase/client";

export async function POST(req: NextRequest) {
  try {
    const insertData = await req.json();
    const supabase = await createSupabaseSSRClient();

    // Try to get the user from the request (using the supabase server client for SSR)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      // This ensures only authenticated users can create gifts (Row Level Security enforced)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use the authenticated user's sub/id as sender, fallback to insertData.sender if present
    const sender =
      user.user_metadata?.sub?.split(":").pop() || user.id || insertData.sender;

    // Prepare safe insert data (avoid allowing client-provided sender)
    const safeInsertData = {
      ...insertData,
      sender,
    };

    const { error } = await supabase.from("gifts").insert([safeInsertData]);

    // If insert fails due to RLS, return 403 with a clear error message
    if (error) {
      // Supabase Postgres RLS error code is '42501'
      if (error.code === "42501") {
        return Response.json(
          {
            error: "Row level security policy prevented insert",
            details: error.message || null,
          },
          { status: 403 }
        );
      }
      // Other DB error
      return Response.json(
        { error: "Supabase insert failed", details: error.message },
        { status: 500 }
      );
    }

    return Response.json(
      { message: "Row inserted successfully" },
      { status: 200 }
    );
  } catch (error) {
    // Unexpected error, not an insert failure
    console.log(error);
    return Response.json({ error: "Question upload failed" }, { status: 500 });
  }
}
