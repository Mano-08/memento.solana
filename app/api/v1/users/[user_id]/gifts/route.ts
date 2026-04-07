import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/app/lib/supabase/server"; // use the SSR server client

export async function POST(req: NextRequest) {
  try {
    const insertData = await req.json();
    const supabase = await createSupabaseServer();

    const { data: claims, error: authError } = await supabase.auth.getClaims();

    console.log("SERVER: ", claims);
    if (authError || !claims) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const safeInsertData = {
      ...insertData,
      sender: claims.claims.user_metadata!.sub.split(":").pop(),
    };

    const { error } = await supabase.from("gifts").insert([safeInsertData]);

    if (error) {
      console.log(error);
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
    console.log(error);
    return Response.json({ error: "Question upload failed" }, { status: 500 });
  }
}
