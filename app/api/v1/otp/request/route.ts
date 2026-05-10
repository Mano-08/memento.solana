import { sendOtpToEmailAddress } from "@/app/lib/nodemailer/mail";
import { createSupabaseServer } from "@/app/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function isValidEmail(email: string): boolean {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { gift_pda, email, salt } = body;

    let saltBytes: Uint8Array | null = null;
    try {
      if (typeof salt === "string") {
        const decoded = Buffer.from(salt, "base64");
        saltBytes = new Uint8Array(
          decoded.buffer,
          decoded.byteOffset,
          decoded.length
        );
      }
    } catch (e) {
      saltBytes = null;
    }

    if (!saltBytes) {
      return NextResponse.json(
        { error: "Invalid salt format" },
        { status: 400 }
      );
    }

    if (!gift_pda || typeof gift_pda !== "string" || gift_pda.length < 32) {
      return NextResponse.json({ error: "Invalid gift_pda" }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServer();

    const { data: gift, error } = await supabase
      .from("gifts")
      .select("security_question")
      .eq("gift_pda", gift_pda)
      .single();

    if (error || !gift) {
      return NextResponse.json(
        { error: "Gift not found or database error" },
        { status: 404 }
      );
    }

    try {
      const otp = Array.from({ length: 4 }, () =>
        Math.floor(Math.random() * 10)
      ).join("");

      const timestamp = new Date().toISOString();

      const { error: otpError } = await supabase.from("otp").upsert(
        [
          {
            email,
            secret_code: otp,
            created_at: timestamp,
          },
        ],
        { onConflict: "email" }
      );

      if (otpError) {
        console.log(otpError);
        return NextResponse.json(
          {
            message: "Failed to generate secret_code",
            error: otpError.message,
          },
          { status: 500 }
        );
      }

      const maxAttempts = 3;
      let attempt = 0;
      let sendResult;
      let success = false;
      let lastError;

      while (attempt < maxAttempts && !success) {
        sendResult = await sendOtpToEmailAddress({ otp, email });
        if (!sendResult.error) {
          success = true;
        } else {
          lastError = sendResult.message;
          // Exponential backoff: 500ms, 1000ms, 2000ms
          await new Promise((res) =>
            setTimeout(res, 500 * Math.pow(2, attempt))
          );
        }
        attempt++;
      }

      if (!success) {
        return NextResponse.json(
          {
            message: "Failed to send OTP email after multiple attempts",
            error: lastError,
          },
          { status: 500 }
        );
      }

      // DO NOT return the OTP in production, only for debugging/local/dev!
      return NextResponse.json(
        {
          email,
          // otp, // In prod, never send back the OTP!
          message: "secret_code generated successfully",
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("[API] OTP upsert error", error);
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[API] General error", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
