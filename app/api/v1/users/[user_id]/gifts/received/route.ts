import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/app/lib/supabase/server";

// GET /api/v1/users/[user_id]/gifts/received
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  try {
    const supabase = await createSupabaseServer();
    const userId = (await params).user_id;

    const { data: received, error: receivedError } = await supabase
      .from("gifts_received")
      .select("gift_pda")
      .eq("recipient", userId);

    if (receivedError) {
      return Response.json(
        {
          error: "Failed to fetch received gifts",
          details: receivedError.message,
        },
        { status: 500 }
      );
    }
    return Response.json({ data: received }, { status: 200 });
  } catch (error) {
    return Response.json(
      {
        error: "Unexpected error while fetching received gifts",
        details: error instanceof Error ? error.message : error,
      },
      { status: 500 }
    );
  }
}
