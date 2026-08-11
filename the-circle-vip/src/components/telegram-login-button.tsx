"use client";

import { useEffect, useRef } from "react";

type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

type Props = {
  botUsername: string;
  onAuth: (user: TelegramUser) => void;
};

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

export function TelegramLoginButton({ botUsername, onAuth }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onAuthRef = useRef(onAuth);
  onAuthRef.current = onAuth;

  useEffect(() => {
    window.onTelegramAuth = (user) => {
      onAuthRef.current(user);
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");

    const node = containerRef.current;
    if (node) {
      node.innerHTML = "";
      node.appendChild(script);
    }

    return () => {
      delete window.onTelegramAuth;
      if (node) {
        node.innerHTML = "";
      }
    };
  }, [botUsername]);

  return <div ref={containerRef} className="flex justify-center" />;
}
