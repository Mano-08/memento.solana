import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { token, ip } = data;
    const payload = {
      secret: process.env.HCAPTCHA_SECRET_KEY! as string,
      response: token,
      remoteip: ip,
      sitekey: process.env.HCAPTCHA_SITE_KEY! as string,
    };
    const params = new URLSearchParams(payload);
    const res = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST",
      body: params,
    });
    const j = await res.json();
    if (j.success) {
      return Response.json({ success: true });
    } else {
      return Response.json(
        { success: false, errors: j["error-codes"] || [] },
        { status: 400 }
      );
    }
  } catch (error) {
    return Response.json(
      { success: false, errors: ["internal_error"] },
      { status: 500 }
    );
  }
}
