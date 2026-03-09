import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const insertData = await req.json();
    const supabase = await createClient();
    const { error } = await supabase.from("gifts").insert([insertData]);

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
