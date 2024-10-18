
// @ts-nocheck
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import SocketService from "@/providers/socket";
import { Trade } from "@/types/trade";

export const useTvDataFeed = (tokenId: string, tokenSymbol: string, poolId: string) => {
  const pathname = usePathname();

  return useMemo(() => {
    return makeDataFeed(tokenId, tokenSymbol, poolId);
  }, [pathname, tokenId, tokenSymbol]);
};

const lastBarsCache = new Map();

const makeDataFeed = (tokenId: string, tokenSymbol: string, poolId: string) => {
  let subscriptions = {};
  let realtimeHandler = false;

  const getApi = async (url: string) => {
    try {
      const response = await fetch(url, {
        credentials: "include",
        headers: {
          "x-api-key": process.env.NEXT_PUBLIC_DATA_API_KEY as string,
        }
      });
      if (response.ok) {
        const resp = await response.json();
        return resp.oclhv;
      } else if (response.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return await getApi(url);
      }
    } catch (err) {
    }
    return null;
  };

  const handleMarks = async (
    symbolInfo: any,
    startDate: number,
    endDate: number,
    onDataCallback: any,
    resolution: string
  ) => {
    let owner = localStorage.getItem("chart-wallet");
    let deployer = localStorage.getItem("chart-deployer");

    onDataCallback([], { noData: true });

    const parseDeployerTrades = (trades: Trade[]) => {
      const markers = trades.map((trade: Trade, index: number) => ({
        id: trade.tx,
        time: trade.time / 1000,
        color: trade.type === "sell" ? "red" : "blue",
        text: [
          `${trade.type === "buy" ? "Dev bought" : "Dev sold"
          } $${trade.volume.toFixed(2)} USD worth of ${tokenSymbol}`,
        ],
        label: trade.type === "sell" ? "DS" : "DB",
        labelFontColor: "white",
        minSize: 25,
      }));

      onDataCallback(markers);
    };
    const parseTrades = (trades: Trade[]) => {
      const markers = trades.map((trade: Trade, index: number) => ({
        id: trade.tx,
        time: trade.time / 1000,
        color: trade.type === "sell" ? "red" : "blue",
        text: [
          `${trade.type === "buy" ? "Bought" : "Sold"} $${trade.volume.toFixed(
            2
          )} USD worth of ${tokenSymbol}`,
        ],
        label: trade.type === "sell" ? "S" : "B",
        labelFontColor: "white",
        minSize: 25,
      }));

      onDataCallback(markers);
    };
    const fetchData = async () => {
      onDataCallback([], { noData: true });
      if (owner && owner !== "") {
        try {
          const response = await fetch(
            `https://data.solanatracker.io/trades/${tokenId}/${poolId}/${owner}`,
            {
              cache: "no-cache",
              credentials: "include",
              headers: {
                "x-api-key": process.env.NEXT_PUBLIC_DATA_API_KEY as string,
              }
            }
          ).then((res) => res.json());
          if (response && response.trades?.length > 0) {
            const trades = response.trades;
            parseTrades(trades);
          }
        } catch (error) {
          console.error("Error fetching data: ", error);
        }
      }

      if (deployer && deployer !== "") {
        try {
          const response = await fetch(
            `https://data.solanatracker.io/trades/${tokenId}/${poolId}/${deployer}`,
            {
              cache: "no-cache",
              credentials: "include",
              headers: {
                "x-api-key": process.env.NEXT_PUBLIC_DATA_API_KEY as string,
              }
            }
          ).then((res) => res.json());
          if (response && response.trades?.length > 0) {
            const trades = response.trades;

            parseDeployerTrades(trades);
          }
        } catch (error) {
          console.error("Error fetching data: ", error);
        }
      }
    };

    fetchData();

    setInterval(() => {
      let newOwner = localStorage.getItem("chart-wallet");
      if (newOwner !== owner) {
        let oldOwner = owner;
        owner = newOwner;
        const socket = SocketService.getSocket();
        if (socket) {
          SocketService.leaveRoom(
            `transaction:${tokenId}:${poolId}:${oldOwner}`
          );
          SocketService.leaveRoom(
            `transaction:${tokenId}:${poolId}:${oldOwner}`
          );

          SocketService.joinRoom(`transaction:${tokenId}:${poolId}:${owner}`);
          SocketService.joinRoom(
            `transaction:${tokenId}:${poolId}:${deployer}`
          );

          SocketService.on(
            `transaction:${tokenId}:${poolId}:${owner}`,
            (data: any) => {
              if (data) {
                parseTrades(data);

                // @ts-ignore
                window.inst.activeChart().refreshMarks();
              }
            }
          );

          SocketService.on(
            `transaction:${tokenId}:${poolId}:${deployer}`,
            (data: any) => {
              if (data) {
                parseDeployerTrades(data);

                // @ts-ignore
                window.inst.activeChart().refreshMarks();
              }
            }
          );
        }
        fetchData();
      }
    }, 1000);
  };

  let lastPrice = 0;
  const handleRealtimeUpdate =
    (symbolInfo: any, resolution: string, onRealtimeCallback: any) => (data: any) => {
      try {
        const activeResolution = resolution;
        if (!data?.pool) return;

        if (lastPrice === 0) {
          lastPrice = data.price;
        } else if (lastPrice === data.price) {
          return;
        }
        const price = data.price;
        const latestBar = lastBarsCache.get(symbolInfo.full_name);

        const currentTimestamp = Math.floor(Date.now() / 1000);
        const currentBarTimestamp =
          activeResolution === "1S"
            ? currentTimestamp
            : Math.floor(
              currentTimestamp / getResolutionInSeconds(activeResolution)
            ) * getResolutionInSeconds(activeResolution);

        let newBar;
        if (latestBar && currentBarTimestamp === latestBar.time / 1000) {
          newBar = {
            ...latestBar,
            high: Math.max(latestBar.high, price),
            low: Math.min(latestBar.low, price),
            close: price,
            volume: latestBar.volume,
          };
        } else {
          const openPrice = latestBar ? latestBar.close : price;
          newBar = {
            time: currentBarTimestamp * 1000,
            open: openPrice,
            high: openPrice,
            low: openPrice,
            close: price === 0 ? openPrice : price,
            volume: 0,
          };
        }

        lastBarsCache.set(symbolInfo.full_name, { ...newBar });
        onRealtimeCallback(newBar);
      } catch (error) {
        console.error(error);
      }
    };
  const getResolutionInSeconds = (resolution: string) => {
    switch (resolution) {
      case "1S":
        return 0;
      case "1":
        return 60;
      case "5":
        return 300;
      case "15":
        return 900;
      case "30":
        return 1800;
      case "60":
        return 3600;
      case "240":
        return 14400;
      case "360":
        return 21600;
      case "720":
        return 43200;
      case "1440":
        return 86400;
      default:
        return 60;
    }
  };
  return {
    onReady(callback: any) {
      setTimeout(
        () =>
          callback({
            ticker: tokenSymbol,
            name: tokenSymbol,
            description: `${tokenSymbol}`,
            type: tokenSymbol,
            session: "24x7",
            timezone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
            minmov: 1,
            pricescale: 1000000000000,
            has_intraday: true,
            intraday_multipliers: [
              "1S",
              "1",
              "5",
              "15",
              "30",
              "60",
              "240",
              "360",
              "720",
              "1440",
            ],
            volume_precision: 8,
            has_seconds: true,
            seconds_multipliers: [1],
            data_status: "streaming",
            intervals: [
              "1S",
              "1",
              "5",
              "15",
              "30",
              "60",
              "240",
              "360",
              "720",
              "1440",
            ],
            supported_resolutions: [
              "1S",
              "1",
              "5",
              "15",
              "30",
              "60",
              "240",
              "360",
              "720",
              "1440",
            ],
            supports_marks: true,
            visible_plots_set: "ohlcv",
            base_name: [tokenSymbol],
            legs: [tokenSymbol],
            full_name: tokenSymbol,
            pro_name: tokenSymbol,
            price_sources: [],
          }),
        0
      );
    },
    async resolveSymbol(
      symbolName: string,
      onSymboleResolvedCallback: any,
      onResolveErrorCallback: any,
      extension: any
    ) {
      let result = {
        ticker: tokenSymbol,
        name: tokenSymbol,
        description: `${tokenSymbol}`,
        type: tokenSymbol,
        session: "24x7",
        timezone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
        minmov: 1,
        supports_timescale_marks: true,
        supports_marks: true,
        pricescale: 100000000000000,
        has_intraday: true,
        intraday_multipliers: [
          "1S",
          "1",
          "5",
          "15",
          "30",
          "60",
          "240",
          "360",
          "720",
          "1440",
        ],
        volume_precision: 8,
        has_seconds: true,
        seconds_multipliers: [1],
        data_status: "streaming",
        seconds_resolution: 1,
        supported_resolutions: [
          "1S",
          "1",
          "5",
          "15",
          "30",
          "60",
          "240",
          "360",
          "720",
          "1440",
        ],
        supports_marks: true,
        visible_plots_set: "ohlcv",
        base_name: [tokenSymbol],
        legs: [tokenSymbol],
        full_name: tokenSymbol,
        pro_name: tokenSymbol,
        price_sources: [],
      };
      setTimeout(() => {
        onSymboleResolvedCallback(result);
      }, 0);
    },
    getMarks(symbolInfo, startDate, endDate, onDataCallback, resolution) {
      handleMarks(symbolInfo, startDate, endDate, onDataCallback, resolution);
    },
    getBars: async (
      symbolInfo,
      resolution,
      periodParams,
      onHistoryCallback,
      onErrorCallback
    ) => {
      const { from, to, firstDataRequest } = periodParams;

      if (!firstDataRequest) {
        onHistoryCallback([], {
          noData: true,
        });
        return;
      }
      try {
        let data = await getApi(
          `https://data.solanatracker.io/chart/${tokenId}/${poolId}`
        );

        if (!data || data.length === 0) {
          data = await getApi(
            `https://data.solanatracker.io/chart/${tokenId}`
          );
        }

        // Check if data is null or undefined
        if (!data || data.length === 0) {
          onHistoryCallback([], {
            noData: true,
          });
          return;
        }

        let bars = [];

        data.forEach((bar) => {
          if (
            bar &&
            (firstDataRequest || (bar.time >= from && bar.time < to))
          ) {
            bars.push({
              time: bar.time * 1000,
              low: bar.low,
              high: bar.high,
              open: bar.open,
              close: bar.close,
              volume: bar.volume,
            });
          }
        });

        if (firstDataRequest && bars.length > 0) {
          lastBarsCache.set(symbolInfo.full_name, {
            ...bars[bars.length - 1],
          });
        }

        onHistoryCallback(bars, {
          noData: bars.length === 0,
        });
      } catch (error) {
        console.error("Error in getBars:", error);
        onErrorCallback(error);
      }
    },

    async subscribeBars(
      symbolInfo,
      resolution,
      onRealtimeCallback,
      subscriberUID,
      onResetCacheNeededCallback
    ) {
      if (subscriptions[subscriberUID]) {
        subscriptions[subscriberUID].stop();
        delete subscriptions[subscriberUID];
      }

      let stopped = false;
      let latestPrice = null;

      subscriptions[subscriberUID] = {
        stop: () => {
          stopped = true;
          clearInterval(intervalId);
          SocketService.leaveRoom(`price:${poolId}`);
        },
      };

      realtimeHandler = handleRealtimeUpdate(
        symbolInfo,
        resolution,
        onRealtimeCallback
      );

      SocketService.connect();
      const socket = SocketService.getSocket();

      if (socket) {
        SocketService.joinRoom(`price:${poolId}`);
        SocketService.on(`price:${poolId}`, (data: any) => {
          if (data.pool) {
            latestPrice = data;
          }
        });
      }

      let latestUpdate = 0;

      const intervalId = setInterval(() => {
        if (
          !stopped &&
          latestPrice &&
          realtimeHandler &&
          latestUpdate !== latestPrice.price
        ) {
          latestUpdate = latestPrice.price;
          realtimeHandler(latestPrice);
        }
      }, 10);
    },
    unsubscribeBars(subscriberUID) {
      for (const key in subscriptions) {
        if (key === subscriberUID) {
          subscriptions[key].stop();
          delete subscriptions[key];
        }
      }
    },
  };
};
