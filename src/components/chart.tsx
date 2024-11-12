"use client";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { Pool, iToken } from "@/types/token";

const TVChartContainer = dynamic(
    () => import("@/components/trading-view/index"),
    {
        ssr: false,
    }
);

export type Props = {
    tokenAddress: string;
};

export default function Chart({ tokenAddress }: Props) {
    const [token, setToken] = useState<iToken>();
    const [pool, setPool] = useState<Pool>();

    useEffect(() => {
        const fetchPools = async () => {
            const res = await fetch(
                `https://data.solanatracker.io/tokens/${tokenAddress}`, {
                headers: {
                    'x-api-key': process.env.NEXT_PUBLIC_DATA_API_KEY as string
                }
            }
            );
            const data = await res.json();
            if (data?.pools?.length > 0) {
                setPool(data.pools[0]);
                setToken(data);
            }
        };
        fetchPools();
    }, [tokenAddress]);

    useEffect(() => {
        document.querySelector("#st-footer")?.remove();
        document.querySelector(".min-h-screen")?.classList.remove("min-h-screen");
        setInterval(() => {
            const html = document.querySelector("html");
            if (html && html !== null) {
                html.style.colorScheme = "";
            }
        }, 100);
    }, [document.querySelector("body")]);

    return (
        <div className="bg-background w-full">
            {pool && token ? (
                <TVChartContainer
                    tokenId={pool.tokenAddress}
                    tokenSymbol={token.token.symbol || token.token.name}
                    poolId={pool.poolId}
                    pools={token.pools.map((p) => p.poolId)}
                />
            ) : null}
        </div>
    );
}
