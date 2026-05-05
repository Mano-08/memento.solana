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
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const createdOn = `${yyyy}-${mm}-${dd}`;

    const upload = await pinata.upload.public.json({
      name,
      symbol: "GIFT",
      description,
      image: `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${imageCid}`,
      external_url: "https://www.google.com",
      seller_fee_basis_points: 0,
      attributes: [
        {
          trait_type: "Type",
          value: "Gift NFT",
        },
        {
          trait_type: "Created On",
          value: createdOn,
        },
      ],
      properties: {
        files: [
          {
            uri: `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${imageCid}`,
            type: "image/png",
          },
        ],
        category: "image",
        creators: [],
      },
      collection: null,
    });
    return Response.json({ cid: upload.cid }, { status: 200 });
  } catch (error) {
    console.log(error);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
