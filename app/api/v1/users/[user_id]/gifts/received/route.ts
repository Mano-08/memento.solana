import { NextRequest } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

// GET /api/v1/users/[user_id]/gifts/received
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  try {
    const supabase = await createClient();
    const userId = (await params).user_id;

    // First, get the received gifts' gift_pda values for the user as recipient
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

    const giftPdas = (received ?? []).map((row: any) => row.gift_pda);
    if (giftPdas.length === 0) {
      return Response.json({ data: [] }, { status: 200 });
    }

    // Now, query the gifts table for all gifts matching the gift_pda values
    const { data: gifts, error: giftsError } = await supabase
      .from("gifts")
      .select("*")
      .in("gift_pda", giftPdas);

    if (giftsError) {
      return Response.json(
        {
          error: "Failed to fetch gift details",
          details: giftsError.message,
        },
        { status: 500 }
      );
    }

    return Response.json({ data: gifts }, { status: 200 });
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
