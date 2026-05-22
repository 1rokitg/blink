import { Search, Bookmark, Globe } from "lucide-react";
import { Button } from "@acme/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@acme/ui/avatar";
import { HeaderNav } from "./header-nav";
import { HeaderSearch } from "./header-search";
import { Connect } from "../connect";

export function Header() {
  return (
    <header className="sticky top-0 z-10 px-16">
      <nav className="w-full">
        <div className="grid w-full grid-cols-[min-content_auto_min-content] items-center gap-x-8 px-3 py-1 lg:grid-cols-[1fr_minmax(auto,520px)_1fr] lg:gap-x-12">
          <div className="flex items-center gap-8 ">
            {/* Mobbin Logo */}
            <a
              href="/"
              className="focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded"
            >
              <svg
                width="43"
                height="20"
                viewBox="0 0 139 64"
                fill="currentColor"
                className="h-5 w-[43px] fill-white"
              >
                <title>Mobbin</title>
                <path d="M84.3504 64H48.1695V47.315L32.569 63.9989L0 63.9841V29.9515L28.31 0H67.4439V15.9214L82.6881 0H116.593V26.1874H139V64H99.1163V48.208L84.3504 64Z" />
              </svg>
            </a>

            {/* Navigation - hidden on mobile, shown on desktop */}
            <HeaderNav />
          </div>

          <HeaderSearch />

          <div className="shrink-0 pl-4 lg:px-0">
            <div className="flex flex-row items-center gap-4 lg:justify-end">
              <div className="flex flex-row items-center gap-2">
                {/* Bookmark icon - hidden on mobile */}
                <div className="hidden lg:inline-flex">
                  <a
                    href="/saved/mobile/screens"
                    className="p-1 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded"
                  >
                    <div className="h-7 w-7 flex items-center justify-center">
                      <Bookmark className="h-5 w-5 text-gray-400 hover:text-white transition-colors" />
                    </div>
                  </a>
                </div>

                {/* Globe/Community icon - hidden on mobile */}
                <div className="hidden lg:inline-flex">
                  <a
                    href="/community/mobile/featured"
                    className="p-1 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded"
                  >
                    <div className="h-7 w-7 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-gray-400 hover:text-white transition-colors" />
                    </div>
                  </a>
                </div>
              </div>

              {/* Get Pro button - hidden on mobile */}
              <div className="hidden items-center justify-center lg:flex">
                <Connect />
              </div>

              {/* User Avatar */}
              <button
                type="button"
                className="hover:opacity-90 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 transition-opacity rounded-full"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage
                    src="https://lh3.googleusercontent.com/a/ACg8ocLmWFDBA7VbWqGnGuwfD1oqw2t7HWO17q0frOEXKLj3iMk7xEl2=s96-c"
                    alt="Avatar of Omar"
                  />
                  <AvatarFallback className="bg-blue-600 text-white text-sm">
                    O
                  </AvatarFallback>
                </Avatar>
              </button>
            </div>
          </div>

          <div className="col-span-full row-start-2 lg:hidden">
            <div className="flex items-center py-4 gap-6">
              <a
                href="/discover/apps/ios/latest"
                className="text-sm font-semibold text-gray-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded px-1 py-1"
              >
                Apps
              </a>
              <a
                href="/discover/sites/latest"
                className="text-sm font-semibold text-white hover:text-gray-300 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded px-1 py-1"
              >
                Sites
              </a>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
