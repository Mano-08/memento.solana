import { NextRequest } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Read recipient and gift_pda from the POSTed JSON body (not params)
    const body = await req.json();
    const { recipient, gift_pda } = body;
    console.log(recipient, gift_pda);

    const { error } = await supabase.from("gifts_received").insert([
      {
        recipient,
        gift_pda,
      },
    ]);

    if (error) {
      return Response.json(
        { error: "Failed to insert", details: error.message },
        { status: 400 }
      );
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    return Response.json(
      {
        error: "Unexpected error",
        details: error instanceof Error ? error.message : error,
      },
      { status: 500 }
    );
  }
}
