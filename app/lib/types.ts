import { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";
import { TransactionSigner } from "@solana/kit";
import { UiWalletAccount } from "@wallet-standard/react";

export enum CreateGiftStage {
  NotStarted = "not_started",
  PreparingTransaction = "running_simulation",
  UploadingImage = "uploading_image", // Correct spelling
  WrappingGift = "wrapping_gift", // Locking/wrapping the NFT as a gift
  SavingGiftInfo = "saving_gift_information", // Saving gift details to database
  GiftCreatedSuccessfully = "gift_created_successfully", // Success stage
  Error = "error",
}

export type CreateGiftData = {
  name: string;
  giftAmount: number;
  email: string;
  birthday: string;
  securityQuestion: string;
  securityAnswer: string;
};

export enum GiftCreationStatus {
  Loading = "loading",
  Success = "success",
  Error = "error",
}

export type SendGiftWithEmbeddedWalletProps = {
  wallet: ConnectedStandardSolanaWallet;
  imageFile: File | null;
  setGiftInputError: React.Dispatch<
    React.SetStateAction<GiftInputError | null>
  >;
  createGiftData: CreateGiftData;
};

export type GiftCreationStage = {
  info?: string;
  stage: CreateGiftStage;
  status: GiftCreationStatus;
  errorMessage: string;
};

export type SendGiftWithExternalWalletProps = {
  uiWalletAccount: UiWalletAccount;
  imageFile: File | null;
  setGiftInputError: React.Dispatch<
    React.SetStateAction<GiftInputError | null>
  >;
  createGiftData: CreateGiftData;
};

export enum GiftInputError {
  gift_name = "gift_name",
  gift_image = "gift_image",
  reveal_date = "reveal_date",
  recipient_email = "recipient_email",
  gift_amount = "gift_amount",
  security_question = "security_question",
  security_answer = "security_answer",
}

export type SendGiftProps = {
  signer: TransactionSigner<string>;
  imageFile: File | null;
  setGiftInputError: React.Dispatch<
    React.SetStateAction<GiftInputError | null>
  >;
  createGiftData: CreateGiftData;
};
