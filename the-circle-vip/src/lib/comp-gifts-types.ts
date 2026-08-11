export type CompGiftStatus =
  | "pending"
  | "redeemed"
  | "revoked"
  | "expired";

export type CompGiftRecord = {
  id: string;
  planId: "month";
  email: string | null;
  telegramUsername: string | null;
  note: string | null;
  label: string | null;
  status: CompGiftStatus;
  inviteLink: string | null;
  subscriptionId: string | null;
  createdAt: string;
  createdBy: string;
  expiresAt: string | null;
  redeemedAt: string | null;
};

export type PublicCompGiftView = {
  id: string;
  label: string | null;
  note: string | null;
  email: string | null;
  telegramUsername: string | null;
  status: CompGiftStatus;
  expiresAt: string | null;
  usable: boolean;
};
