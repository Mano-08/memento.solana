import { NextRequest } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gift_id: string }> }
) {
  try {
    const supabase = await createClient();
    const giftId = (await params).gift_id;

    // Query the gifts table for the row with gift_id = giftId.
    const { data, error } = await supabase
      .from("gifts")
      .select("*")
      .eq("gift_pda", giftId)
      .single();

    if (error) {
      return Response.json(
        { error: "Gift not found", details: error.message },
        { status: 404 }
      );
    }

    return Response.json({ data }, { status: 200 });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to fetch gift",
        details: error instanceof Error ? error.message : error,
      },
      { status: 500 }
    );
  }
}
