import { Button } from "@acme/ui/button";
import { motion } from "motion/react";
import { useState } from "react";
import { Wallet } from "lucide-react";
import { Input } from "@acme/ui/input";
import { authModalState, type SignInMethod } from "~/lib/context/auth";

export function DefaultState() {
  const tabs = ["email", "phone", "passkey"] as const;
  const [activeTab, setActiveTab] = useState<"email" | "phone" | "passkey">(
    "email",
  );

  const handleSocialLogin = (provider: string) => {
    // Handle social login
    console.log(`Login with ${provider}`);
  };

  const selectWalletMethod = () => {
    authModalState.send({ type: "SELECT_METHOD", method: "wallet" });
  };
  return (
    <>
      <div className="flex flex-col space-y-1.5 text-center sm:text-left">
        <h2 className="flex items-center justify-between text-xl p-6">
          <span className="font-openrude font-semibold  w-full pr-8 text-start">
            Sign In
          </span>
        </h2>
      </div>
      <div className="flex flex-col gap-4 pt-2">
        <div className="flex flex-col gap-2 px-6">
          <div className="flex w-full items-center justify-center gap-2">
            <Button className="group bg-[#171717] h-[48px] w-full rounded-xl">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="800"
                height="800"
                viewBox="0 0 800 800"
                fill="none"
                className="fill-gray-600 group-hover:fill-gray-300 size-5 transition-colors duration-200 ease-out"
              >
                <title>Google</title>
                <path d="M0 400C0 179.44 179.44 0 400 0C489.078 0 573.39 28.6591 643.825 82.88L550.872 203.627C507.322 170.103 455.15 152.381 400 152.381C263.463 152.381 152.381 263.463 152.381 400C152.381 536.537 263.463 647.619 400 647.619C509.97 647.619 603.421 575.57 635.627 476.19H400V323.81H800V400C800 620.56 620.56 800 400 800C179.44 800 0 620.56 0 400Z" />
              </svg>
            </Button>
            <Button className="group bg-[#171717] h-[48px] w-full rounded-xl">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                xmlSpace="preserve"
                width="209"
                height="256"
                viewBox="0 0 814 1000"
                className="fill-gray-600 group-hover:fill-gray-300 size-5 transition-colors duration-200 ease-out"
              >
                <title>Apple</title>
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
              </svg>
            </Button>
          </div>
          <div className="flex h-12 w-full items-center rounded-2xl bg-[#F5F5F5] px-1 dark:bg-[#171717]">
            <div className="relative mx-auto flex w-full items-center">
              <ul className="mx-auto flex w-full flex-row justify-center gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    aria-label={`Select ${tab.charAt(0).toUpperCase() + tab.slice(1)}`}
                    className={`${activeTab === tab ? "text-gray-200" : "text-[#6e6e6e]"} relative flex h-10 w-full cursor-pointer items-center justify-center px-3 py-[6px] text-center text-base font-semibold transition-colors duration-200 ease-out sm:font-medium group`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {activeTab === tab && (
                      <motion.div
                        initial={false}
                        layoutId="tab-indicator"
                        className="absolute inset-0 rounded-xl bg-black/5 dark:bg-white/5"
                        transition={{
                          type: "spring",
                          duration: 0.4,
                          bounce: 0,
                        }}
                      />
                    )}
                    <span className="relative text-inherit select-none">
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </span>
                  </button>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4 px-6">
          <div className="space-y-4">
            {activeTab === "email" && (
              <div className="font-openrunde flex h-12 w-full items-center justify-start gap-3 overflow-hidden rounded-2xl bg-[#F5F5F5] pr-1 pl-2 text-base dark:bg-[#171717]">
                <div className="flex w-full items-center justify-start">
                  <Input
                    id="email"
                    placeholder="email@acme.com"
                    className="text-gray-100 sm:font-regular w-full bg-transparent text-base font-medium placeholder:text-gray-600 focus-visible:outline-hidden outline-none border-none ring-0 disabled:cursor-not-allowed disabled:opacity-50"
                    type="email"
                  />
                </div>
                <button
                  aria-label="Continue"
                  className="group flex h-10 w-12 shrink-0 items-center justify-center rounded-xl shadow-xs transition-colors duration-200 ease-out cursor-not-allowed bg-[#222]"
                  disabled
                  type="submit"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    className="size-5 stroke-gray-600"
                  >
                    <title>Continue</title>
                    <path
                      d="M4 12H20M20 12L14 6M20 12L14 18"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            )}

            {activeTab === "phone" && (
              <div className="font-openrunde flex h-12 w-full items-center justify-start gap-3 overflow-hidden rounded-2xl bg-[#F5F5F5] pr-1 pl-2 text-base dark:bg-[#171717]">
                <div className="flex w-full items-center justify-start">
                  <Input
                    id="email"
                    placeholder="email@acme.com"
                    className="text-gray-100 sm:font-regular w-full bg-transparent text-base font-medium placeholder:text-gray-600 focus-visible:outline-hidden outline-none border-none ring-0 disabled:cursor-not-allowed disabled:opacity-50"
                    type="email"
                  />
                </div>
                <button
                  aria-label="Continue"
                  className="group flex h-10 w-12 shrink-0 items-center justify-center rounded-xl shadow-xs transition-colors duration-200 ease-out cursor-not-allowed bg-[#222]"
                  disabled
                  type="submit"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    className="size-5 stroke-gray-600"
                  >
                    <title>Continue</title>
                    <path
                      d="M4 12H20M20 12L14 6M20 12L14 18"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </div>
            )}

            {activeTab === "passkey" && (
              <div className="font-openrunde flex h-12 w-full items-center justify-start gap-3 overflow-hidden rounded-2xl bg-[#F5F5F5] pr-1 pl-2 text-base dark:bg-[#171717]">
                <div className="flex w-full items-center justify-start">
                  <Input
                    id="email"
                    placeholder="email@acme.com"
                    className="text-gray-100 sm:font-regular w-full bg-transparent text-base font-medium placeholder:text-gray-600 focus-visible:outline-hidden outline-none border-none ring-0 disabled:cursor-not-allowed disabled:opacity-50"
                    type="email"
                  />
                </div>
                <button
                  aria-label="Continue"
                  className="group flex h-10 w-12 shrink-0 items-center justify-center rounded-xl shadow-xs transition-colors duration-200 ease-out cursor-not-allowed bg-[#222]"
                  disabled
                  type="submit"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    className="size-5 stroke-gray-600"
                  >
                    <title>Continue</title>
                    <path
                      d="M4 12H20M20 12L14 6M20 12L14 18"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4 px-6 pb-6">
          <div className="relative">
            <div className="absolute inset-0 flex h-[40px] items-center">
              <span className="w-full rounded-full border-t border-secondary" />
            </div>
            <div className="relative flex h-[40px] justify-center text-xs uppercase">
              <span className="font-openrunde flex items-center justify-center bg-[#111111] px-2 font-medium text-gray-400">
                Or
              </span>
            </div>
          </div>
          <Button
            onClick={selectWalletMethod}
            className="flex h-[48px] w-full rounded-full justify-center items-center font-semibold sm:font-medium text-base text-white bg-blue-500 hover:bg-blue-600 gap-2"
          >
            <Wallet className="size-5 shrink-0 stroke-white" />
            Connect Wallet
          </Button>
        </div>
      </div>
    </>
  );
}
