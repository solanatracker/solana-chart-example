import Chart from "@/components/chart";
import Link from "next/link";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <Link
          key="link"
          href="https://www.solanatracker.io/data-api"
          className="flex items-center space-x-3 rtl:space-x-reverse relative"
        >
          <img width={'25px'} height={'auto'} src="/images/logo.png" />
          <span
            key="site-name"
            className="self-center text-lg font-semibold whitespace-nowrap dark:text-white"
          >
            Solana Tracker
          </span>
        </Link>

        <Chart tokenAddress={"EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"} />
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center"></footer>
    </div>
  );
}
