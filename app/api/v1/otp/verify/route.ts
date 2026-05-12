import { createSupabaseServer } from "@/app/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function isValidEmail(email: string): boolean {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (typeof code !== "string" || !/^\d{4}$/.test(code)) {
      return NextResponse.json(
        { error: "OTP must be a 4-digit number." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServer();

    // Get secret_code and created_at to check the OTP age
    const { data: otpRow, error } = await supabase
      .from("otp")
      .select("secret_code, created_at")
      .eq("email", email)
      .single();

    if (error) {
      console.error("[API] Database error while fetching OTP", error);
      return NextResponse.json(
        { error: "Failed to lookup OTP" },
        { status: 500 }
      );
    }
    if (!otpRow) {
      return NextResponse.json(
        { error: "No OTP requested for this email" },
        { status: 404 }
      );
    }

    // Check OTP age: must not be older than 10 minutes (600000 ms)
    if (!otpRow.created_at) {
      return NextResponse.json(
        { error: "OTP missing creation time" },
        { status: 500 }
      );
    }
    const createdAt = new Date(otpRow.created_at).getTime();
    const now = new Date().getTime();
    if (isNaN(createdAt)) {
      return NextResponse.json(
        { error: "OTP creation time is invalid" },
        { status: 500 }
      );
    }
    const ageMs = now - createdAt;
    if (ageMs > 10 * 60 * 1000) {
      // Invalidate & delete expired OTP
      await supabase.from("otp").delete().eq("email", email);
      return NextResponse.json(
        { error: "OTP has expired. Please request a new one." },
        { status: 410 }
      );
    }

    if (otpRow.secret_code?.toString() !== code) {
      // Wrong OTP
      return NextResponse.json({ error: "Incorrect OTP" }, { status: 410 });
    }

    // Optionally: Invalidate/Delete OTP after successful verification
    await supabase.from("otp").delete().eq("email", email);

    // Successfully verified
    return NextResponse.json(
      {
        message: "OTP verified successfully!",
        email,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] OTP verification error", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
