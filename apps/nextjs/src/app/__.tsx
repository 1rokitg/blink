import { Suspense } from "react";

import { AuthShowcase } from "./_components/auth-showcase";
import {
  CreatePostForm,
  PostCardSkeleton,
  PostList,
} from "./_components/posts";
import { Header } from "~/components/layout/header";
import Chart from "~/components/chart";
import { OrderBook } from "~/components/order-book";

export default function HomePage() {
  return (
    <main className="h-screen">
      <Header />
      <div className="bg-background">
        {/* Main container */}
        <div className="flex h-full flex-col p-3 gap-2">
          {/* Main content area */}
          <div className="flex-1 flex flex-col gap-2">
            {/* Header - 8% of height */}
            <div className="h-20 flex items-center justify-start rounded-xl bg-muted" />

            {/* Bottom section - 92% of height */}
            <div className="h-full flex gap-2">
              {/* Left side with chart and positions - 70% width */}
              <div className="w-[60%] flex flex-col gap-2">
                {/* Chart panel - 70% height */}
                <div className="min-h-[520px] flex items-center justify-center rounded-2xl bg-muted  border-none overflow-hidden">
                  <Chart />
                </div>
              </div>
              {/* Right trading panel - 30% width */}
              <div className="h-[520px] w-[20%] rounded-xl bg-muted no-scrollbar" />

              <div className="w-[20%] rounded-xl bg-muted p-4" />
            </div>
          </div>
          {/* Positions/Orders panel - 30% height */}
          <div className="h-72 rounded-xl bg-muted p-2" />
        </div>
      </div>
    </main>
  );
}
