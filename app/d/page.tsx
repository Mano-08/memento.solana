"use client";
import bs58 from "bs58";
import { useEffect } from "react";

export default function home() {
  //   const bytesz = Uint8Array.from([
  //     83, 156, 137, 243, 223, 52, 82, 213, 41, 108, 251, 102, 180, 55, 153, 252,
  //     170, 170, 67, 138, 240, 63, 251, 250, 212, 100, 133, 47, 139, 103, 136, 95,
  //     77, 227, 51, 68, 139, 233, 44, 71, 179, 218, 178, 111, 251, 153, 61, 99, 71,
  //     252, 197, 148, 6, 49, 47, 60, 83, 83, 91, 137, 81, 214, 7, 14,
  //   ]);

  //   const bytes = Uint8Array.from(
  //     atob(
  //       "lTt7c9d/DsJUd2dDnebERFYLMNf2U8V0rJUdwiyKnY+ms4pRMYm4SkvpYcV9tUbCtCeeOtXPf3UYJRF0/31NZu+0QXGlkZzaOYljhPU2u526b5hhaJC5bCtPD9Wsr++DkkU4tWlVTYsPhctpAAAAAAEA"
  //     ),
  //     (c) => c.charCodeAt(0)
  //   );

  //   const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  //   let offset = 8; // skip discriminator

  //   const gift = bytes.slice(offset, offset + 32);
  //   offset += 32;

  //   const sender = bytes.slice(offset, offset + 32);
  //   offset += 32;

  //   const authorized = bytes.slice(offset, offset + 32);
  //   offset += 32;

  //   const createdOn = view.getBigInt64(offset, true);
  //   offset += 8;

  //   const idx = view.getUint16(offset, true);

  //   console.log("gift:", bs58.encode(gift));
  //   console.log("sender:", bs58.encode(sender));
  //   console.log("authorized:", bs58.encode(authorized));
  //   console.log("createdOn:", createdOn.toString());
  //   console.log("idx:", idx);

  //   const base58 = bs58.encode(bytesz);
  //   console.log(base58);

  return <p>d</p>;
}
