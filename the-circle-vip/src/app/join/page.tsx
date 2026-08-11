import { LandingPage } from "@/components/landing-page";
import { getRequestDictionary } from "@/lib/i18n/server";
import {
  getTelegramBotUsername,
  isTelegramLoginConfigured,
} from "@/lib/telegram";
import { getTelegramSession } from "@/lib/telegram-session";
import { getOrderedPlans } from "@/lib/stripe-catalog";
import { isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Join · The Circle",
  description:
    "Choose your Circle membership — pay with USDC or credit card, get your private Telegram invite.",
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const { dictionary } = await getRequestDictionary();
  const [telegram, plans] = await Promise.all([
    getTelegramSession(),
    getOrderedPlans(),
  ]);

  const errorMessages: Record<string, string> = {
    telegram_login: dictionary.homeErrors.telegramLogin,
  };

  return (
    <LandingPage
      plans={plans}
      initialTelegram={telegram}
      stripeConfigured={isStripeConfigured()}
      telegramLoginConfigured={isTelegramLoginConfigured()}
      telegramBotUsername={getTelegramBotUsername()}
      initialError={
        params.error ? (errorMessages[params.error] ?? params.error) : null
      }
    />
  );
}
