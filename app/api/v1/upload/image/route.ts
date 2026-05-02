import { PinataSDK } from "pinata";
import { NextRequest, NextResponse } from "next/server";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.PINATA_GATEWAY!,
});

export async function POST(req: NextRequest) {
  try {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return Response.json({ error: "File must be an image" }, { status: 400 });
    }
    const upload = await pinata.upload.public.file(file);
    console.log(upload);
    return Response.json({ cid: upload.cid }, { status: 200 });
  } catch (error) {
    console.log(error);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
