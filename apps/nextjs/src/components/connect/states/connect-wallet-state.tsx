import { Button } from "@acme/ui/button";
import { motion } from "motion/react";
import Image from "next/image";
import { authModalState } from "~/lib/context/auth";
import { Plus, Wallet } from "lucide-react";

const wallets = [
  {
    id: "rabby-wallet",
    name: "Rabby Wallet",
    icon: (
      <Image src={"/rabby.svg"} alt="Rabby Wallet" width={32} height={32} />
    ),
  },
  {
    id: "cbw",
    name: "Coinbase Wallet",
    icon: (
      <div className="flex size-8 items-center justify-center rounded-lg border border-black/5 bg-white dark:border-white/5">
        <div className="size-5 rounded bg-[#0700FF]" />
      </div>
    ),
  },
  {
    id: "phantom",
    name: "Phantom",
    icon: (
      <Image
        src={"/phantom.svg"}
        alt="Phantom"
        width={32}
        height={32}
        className="size-8 rounded-lg"
      />
    ),
  },
  {
    id: "rainbow",
    name: "Rainbow",
    icon: (
      <Image
        src={"/rainbow.avif"}
        alt="Rainbow"
        width={32}
        height={32}
        className="size-8 rounded-lg"
      />
    ),
  },
];

export function ConnectWalletState() {
  return (
    <>
      <div className="flex flex-col space-y-1.5 text-center sm:text-left">
        <h2
          id="radix-_r_2_"
          className="tracking-tight font-openrunde flex items-center justify-between px-6 py-6 text-xl font-semibold"
        >
          <button
            aria-label="Back"
            type="button"
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#F5F5F5] transition-colors duration-300 ease-out hover:bg-gray-300 dark:bg-[#171717]"
            onClick={() => authModalState.send({ type: "GO_BACK" })}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="size-5 stroke-gray-200"
            >
              <title>Go Back</title>
              <path
                d="M15 18L9 12L15 6"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <span className="font-openrunde w-full pr-8 font-semibold text-center">
            Connect Wallet
          </span>
        </h2>
      </div>

      <div className="flex flex-col px-6 pb-6">
        <div className="flex flex-col gap-2">
          {wallets.map((wallet) => (
            <motion.div
              key={wallet.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                variant="outline"
                className="w-full justify-start p-4 h-[64px] bg-muted rounded-2xl gap-2 px-4 hover:bg-[#222] transition-colors duration-200 ease-out"
              >
                <div className="flex justify-start items-center gap-3">
                  {wallet.icon}
                  <span className="text-white text-lg font-medium">
                    {wallet.name}
                  </span>
                </div>
              </Button>
            </motion.div>
          ))}
          <motion.div
            key={"other-wallets"}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              variant="outline"
              className="w-full justify-start p-4 h-[64px] bg-muted rounded-2xl gap-2 px-4 hover:bg-[#222]"
            >
              <div className="flex justify-start items-center gap-3">
                <div className="flex rounded-lg justify-center items-center size-8 bg-black/20">
                  <Wallet className="!size-5 text-white/40" />
                </div>
                <span className="text-white text-lg font-medium">
                  Other Wallets
                </span>
              </div>
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="flex px-6 pb-6">
        <button
          type="button"
          className="group font-openrunde flex h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-full hover:bg-rose-700 bg-rose-600 font-semibold text-white transition-colors duration-200 ease-out select-none sm:font-medium"
        >
          <Plus className="size-6" />
          Create a New Wallet
        </button>
      </div>
    </>
  );
}
