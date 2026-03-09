import { NextRequest } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  try {
    const supabase = await createClient();
    const userId = (await params).user_id;

    // Query the gifts table for all rows with created_by = userId.
    const { data, error } = await supabase
      .from("gifts")
      .select("*")
      .eq("created_by", userId);

    if (error) {
      return Response.json(
        { error: "Failed to fetch sent gifts", details: error.message },
        { status: 500 }
      );
    }

    return Response.json({ data }, { status: 200 });
  } catch (error) {
    return Response.json(
      {
        error: "Unexpected error while fetching sent gifts",
        details: error instanceof Error ? error.message : error,
      },
      { status: 500 }
    );
  }
}
