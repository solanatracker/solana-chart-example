// @ts-nocheck
import { useMemo, useEffect, use } from "react";
import { usePathname } from "next/navigation";
import { sleep } from "./utils";
import SocketService from "@/providers/socket";

export const useTvDataFeed = (tokenId, tokenSymbol, poolId, pools) => {
  const pathname = usePathname();

  return useMemo(() => {
    return makeDataFeed(tokenId, tokenSymbol, poolId, pools);
  }, [pathname, tokenId, tokenSymbol, pools]);
};

const lastBarsCache = new Map();
const volumeCache = new Map();


const makeDataFeed = (tokenId, tokenSymbol, poolId, pools = false) => {
  let subscriptions = {};
  let realtimeHandler = false;

  const getApi = async (url: string) => {
    try {
      const response = await fetch(url, {
        credentials: "include",
        headers: {
          'x-api-key': process.env.NEXT_PUBLIC_DATA_API_KEY as string
        }
      });
      if (response.ok) {
        const responseJson = await response.json();
        return responseJson.oclhv;
      }
    } catch (err) { }
    return null;
  };

  // Constants for time units in minutes
  const TIME_UNITS = {
    SECOND: 1 / 60,
    MINUTE: 1,
    HOUR: 60,
    DAY: 1440
  };

  // Resolution mapping object
  const RESOLUTION_MAP = {
    '1S': '1s',
    '1s': '1s',
    '15S': '15s',
    '60': '1h',
    '120': '2h',
    '180': '3h',
    '240': '4h',
    '360': '6h',
    '720': '12h',
    '1440': '1d'
  };

  /**
   * Converts resolution to standardized string format
   * @param {string|number} resolution - Input resolution
   * @returns {string} Formatted resolution string
   */
  function formatResolution(resolution) {
    // Check if resolution is directly mapped
    const directMatch = RESOLUTION_MAP[resolution.toString()];
    if (directMatch) return directMatch;

    // Try parsing as integer for minute-based resolutions
    let minutes;
    try {
      minutes = parseInt(resolution);
    } catch (error) {
      console.error('Invalid resolution format:', resolution);
      return '1h'; // Default fallback
    }

    // Handle minute-based resolutions
    if (minutes < TIME_UNITS.HOUR) {
      return `${minutes}m`;
    }

    // Check if it matches any of the hour/day based resolutions
    const directMinuteMatch = RESOLUTION_MAP[minutes.toString()];
    return directMinuteMatch || '1h'; // Default to 1h if no match found
  }

  /**
   * Builds API query string based on resolution and period parameters
   * @param {Object} params - Parameters for query building
   * @param {string|number} params.resolution - Time resolution
   * @param {Object} params.periodParams - Time period parameters
   * @param {string} params.tokenId - Token identifier
   * @param {string} params.poolId - Pool identifier
   * @returns {string} Complete API endpoint with query parameters
   */
  function buildApiQuery({ resolution, periodParams, tokenId, poolId }) {
    let resolutionStr = formatResolution(resolution);

    const baseQuery = `?type=${resolutionStr.toLowerCase()}`;

    const dayInSeconds = 3600 * 24;
    const timeQuery = periodParams.to - periodParams.from > dayInSeconds
      ? `&time_from=${periodParams.from}&time_to=${periodParams.to}`
      : '';

    if (periodParams.custom && periodParams.to - periodParams.from > dayInSeconds) {
      resolutionStr = '30m';
    }

    return `https://data.solanatracker.io/chart/${tokenId}/${poolId}${baseQuery}${timeQuery}`;
  }

  /**
   * Fetches chart data with retry mechanism
   * @param {string} endpoint - API endpoint
   * @param {number} retries - Number of retry attempts
   * @returns {Promise<Array>} Chart data
   */
  async function fetchChartData(endpoint, retries = 1) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const data = await getApi(endpoint);
        if (data && data.length > 0) {
          return data;
        }
      } catch (error) {
        console.error(`Attempt ${attempt + 1} failed:`, error);
        if (attempt === retries) throw error;
      }
    }
    throw new Error('Failed to fetch chart data after retries');
  }

  // Main function to get chart data
  async function getChartData(resolution, periodParams, tokenId, poolId) {
    const endpoint = buildApiQuery({
      resolution,
      periodParams,
      tokenId,
      poolId
    });

    try {
      return await fetchChartData(endpoint);
    } catch (error) {
      console.error('Error fetching chart data:', error);
      throw error;
    }
  }

  const handleMarks = async (
    symbolInfo,
    startDate,
    endDate,
    onDataCallback,
    resolution
  ) => {
    let owner = localStorage.getItem("chart-wallet");
    let deployer = localStorage.getItem("chart-deployer");

    onDataCallback([], { noData: true });

    const parseDeployerTrades = (trades) => {
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
    const parseTrades = (trades) => {
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
      if (owner && owner !== "" && owner !== "undefined") {
        try {
          const response = await fetch(
            `https://data.solanatracker.io/trades/${tokenId}/${poolId}/${owner}`,
            {
              cache: "no-cache",
              credentials: "include",
              headers: {
                'x-api-key': process.env.NEXT_PUBLIC_DATA_API_KEY as string
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

      if (deployer && deployer !== "" && deployer !== "undefined") {
        try {
          const response = await fetch(
            `https://data.solanatracker.io/trades/${tokenId}/${poolId}/${deployer}`,
            {
              cache: "no-cache",
              credentials: "include",
              headers: {
                'x-api-key': process.env.NEXT_PUBLIC_DATA_API_KEY as string
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

  const getBars = async (
    symbolInfo,
    resolution,
    periodParams,
    onHistoryCallback,
    onErrorCallback
  ) => {
    let { from, to, firstDataRequest } = periodParams;
    if (!firstDataRequest) {
      onHistoryCallback([], {
        noData: true,
      });
      return;
    }

    try {
      let data = await getChartData(resolution, periodParams, tokenId, poolId);

      // Check if data is null or undefined
      if (!data || data.length === 0) {
        onHistoryCallback([], {
          noData: true,
        });
        return;
      }

      let bars = [];

      data.forEach((bar) => {
        if (bar && (firstDataRequest || (bar.time >= from && bar.time < to))) {
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
  };

  let lastPrice = 0;
  const handleRealtimeUpdate =
    (symbolInfo, resolution, onRealtimeCallback) => (data) => {
      try {
        const activeResolution = resolution;
        if (!data?.pool) return;

        if (lastPrice === data.price) {
          return;
        }

        const price = data.price;
        const latestBar = lastBarsCache.get(symbolInfo.full_name);

        if (price !== latestBar?.close) {

          const currentTimestamp = Math.floor(Date.now() / 1000);
          const currentBarTimestamp =
            activeResolution === "1S" || activeResolution === "1s"
              ? currentTimestamp
              : Math.floor(
                currentTimestamp / getResolutionInSeconds(activeResolution)
              ) * getResolutionInSeconds(activeResolution);

          // Get accumulated volume for the current bar
          const currentBarKey = `${symbolInfo.full_name}-${currentBarTimestamp}`;
          const accumulatedVolume = volumeCache.get(currentBarKey) || 0;

          let newBar;
          if (latestBar && currentBarTimestamp === latestBar.time / 1000) {
            newBar = {
              ...latestBar,
              high: Math.max(latestBar.high, price),
              low: Math.min(latestBar.low, price),
              close: price,
              volume: accumulatedVolume, // Use accumulated volume
            };
          } else {
            // Clear old volume cache entries
            for (const [key, value] of volumeCache.entries()) {
              const [symbol, timestamp] = key.split("-");
              if (
                parseInt(timestamp) <
                currentBarTimestamp - getResolutionInSeconds(activeResolution)
              ) {
                volumeCache.delete(key);
              }
            }

            const openPrice = latestBar ? latestBar.close : price;
            newBar = {
              time: currentBarTimestamp * 1000,
              open: openPrice,
              high: openPrice,
              low: openPrice,
              close: price === 0 ? openPrice : price,
              volume: accumulatedVolume,
            };
          }

          lastBarsCache.set(symbolInfo.full_name, { ...newBar });
          onRealtimeCallback(newBar);
        }
      } catch (error) {
        console.error(error);
      }
    };
  const getResolutionInSeconds = (resolution) => {
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
    onReady(callback) {
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
              "5S",
              "15S",
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
    async searchSymbol(userInput, exchange, symbolType, onResult) {
      // const result = await apiGet(`${URL_SERVER}search?query=${userInput}&type=${symbolType}&exchange=${exchange}&limit=${1}`);
      // onResult(result);
    },
    async resolveSymbol(
      symbolName,
      onSymboleResolvedCallback,
      onResolveErrorCallback,
      extension?
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
          "1S",
          "5S",
          "15S",
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
        seconds_resolution: true,
        supported_resolutions: [
          "1s",
          "5s",
          "15s",
          "1S",
          "5S",
          "15S",
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
    getBars,

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
        },
      };

      realtimeHandler = handleRealtimeUpdate(
        symbolInfo,
        resolution,
        onRealtimeCallback
      );

      SocketService.connect();
      const socket = SocketService.getSocket();

      const handleVolume = (txns) => {
        if (!txns || !Array.isArray(txns)) return;

        const currentTimestamp = Math.floor(Date.now() / 1000);
        const currentBarTimestamp =
          resolution === "1S" || resolution === "1s"
            ? currentTimestamp
            : Math.floor(
              currentTimestamp / getResolutionInSeconds(resolution)
            ) * getResolutionInSeconds(resolution);

        const currentBarKey = `${symbolInfo.full_name}-${currentBarTimestamp}`;

        // Calculate total volume from transactions
        const volume = txns.reduce((acc, txn) => acc + (txn.volume || 0), 0);

        // Update volume cache
        const currentVolume = volumeCache.get(currentBarKey) || 0;
        volumeCache.set(currentBarKey, currentVolume + volume);

        // Trigger a real-time update to refresh the current bar with new volume
        const latestPrice = lastBarsCache.get(symbolInfo.full_name)?.close;
        if (latestPrice) {
          realtimeHandler({ price: latestPrice, pool: true });
        }
      };
      if (socket) {
        if (!pools || !pools?.length) {
          SocketService.joinRoom(`price-by-token:${tokenId}`);
          SocketService.joinRoom(`transaction:${tokenId}:${poolId}`);

          // Handle transactions for volume updates
          SocketService.on(`transaction:${tokenId}:${poolId}`, (txns) => {
            handleVolume(txns);
          });

          SocketService.on(`price-by-token:${tokenId}`, (data: any) => {
            if (data.pool) {
              realtimeHandler(data);
            }
          });
        } else {
          SocketService.joinRoom(`transaction:${tokenId}`);

          // Handle transactions for volume updates
          SocketService.on(`transaction:${tokenId}`, (txns) => {
            console.log(txns);
            handleVolume(txns);
          });

          pools.forEach((pool) => {
            SocketService.joinRoom(`price:${pool}`);

            SocketService.on(`price:${pool}`, (data: any) => {
              if (data.pool) {
                realtimeHandler(data);
              }
            });
          });
        }
      }
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
