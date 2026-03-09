import { PinataSDK } from "pinata";
import { NextRequest, NextResponse } from "next/server";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.PINATA_GATEWAY!,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageCid = formData.get("imageCid") as string;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const upload = await pinata.upload.public.json({
      name,
      description,
      image: imageCid,
      external_url: "https://www.google.com",
      seller_fee_basis_points: 0,
      attributes: [
        {
          trait_type: "what",
          value: "Gift NFT",
        },
        {
          trait_type: "created_on",
          value: "12-12-12",
        },
      ],
      properties: {
        files: [
          {
            cid: imageCid,
            type: "image/*",
          },
        ],
        category: "image",
      },
    });
    return Response.json({ cid: upload.cid }, { status: 200 });
  } catch (error) {
    console.log(error);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
