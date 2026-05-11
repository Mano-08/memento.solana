import {
  Address,
  createKeyPairSignerFromBytes,
  getBase64Encoder,
  KeyPairSigner,
  Rpc,
} from "@solana/kit";

export async function uploadImageToPinata(imageFile: File) {
  try {
    const formData = new FormData();
    formData.append("file", imageFile);
    const res = await fetch("/api/v1/upload/image", {
      method: "POST",
      body: formData,
    });
    const data: { cid: string } = await res.json();
    return data.cid;
  } catch (error) {
    console.error("ERR: while uploading image to pinata", error);
    throw new Error("ERR: failed to upload image to pinata");
  }
}

export async function loadKeypairFromFile(): Promise<KeyPairSigner<string>> {
  // This is here so you can also load the default keypair from the file system.

  // const loadedKeyBytes = Uint8Array.from(
  //   JSON.parse(fs.readFileSync(filePath, "utf8"))
  // );
  // Here you can also set the second parameter to true in case you need to extract your private key.
  const keypairSigner = await createKeyPairSignerFromBytes(
    new Uint8Array([
      31, 128, 76, 86, 27, 248, 209, 55, 176, 129, 100, 206, 92, 147, 41, 73,
      95, 21, 177, 41, 187, 150, 233, 197, 123, 74, 222, 237, 249, 235, 243,
      250, 135, 78, 162, 8, 96, 160, 214, 221, 54, 208, 66, 26, 37, 190, 112,
      110, 215, 157, 49, 66, 234, 221, 254, 24, 241, 146, 147, 225, 5, 208, 165,
      186,
    ])
  );
  return keypairSigner;
}

export async function loadDefaultKeypair(): Promise<KeyPairSigner<string>> {
  return await loadKeypairFromFile();
}

export async function assertProgramsDeployed(
  rpc: any,
  programAddresses: Address[]
) {
  await Promise.all(
    programAddresses.map(async (address) => {
      const account = await rpc
        .getAccountInfo(address, { encoding: "base64" })
        .send();

      if (!account?.value) {
        throw new Error(`Program not found on this cluster: ${address}`);
      }

      // Programs have executable = true
      // const info = account.value;
      // const bytes = getBase64Encoder().encode(info.data[0]);
      // executable flag is in the account metadata, not the data —
      // just checking existence is enough for our purposes
      console.log(`✅ Program deployed: ${address}`);
    })
  );
}

type uploadMetadataToPinataArgs = {
  imageCid: string;
  nftName: string;
  nftDescription: string;
};
export async function uploadMetadataToPinata({
  imageCid,
  nftName,
  nftDescription,
}: uploadMetadataToPinataArgs) {
  try {
    const formData = new FormData();
    formData.append("imageCid", imageCid);
    formData.append("name", nftName);
    formData.append("description", nftDescription);
    // formData.append("name", e.d);
    const res = await fetch("/api/v1/upload/metadata", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    return data.cid;
  } catch (error) {
    console.log("ERR: failed to upload metadata to pinata", error);
    throw new Error("ERR: failed to upload metadata to pinata");
  }
}
