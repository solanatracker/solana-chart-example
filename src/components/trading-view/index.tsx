// @ts-nocheck
import "./index.css";

import * as saveLoadAdapter from "./saveLoadAdapter";
import { Card } from "@/components/ui/card";
import {
  ChartingLibraryWidgetOptions,
  IChartingLibraryWidget,
  widget,
} from "../../../public/static/chart_library";

import { flatten } from "./utils/utils";
import React from "react";
import { convertResolutionToApi, useTvDataFeed } from "./utils/Datafeed";

export interface ChartContainerProps {
  symbol: ChartingLibraryWidgetOptions["symbol"];
  interval: ChartingLibraryWidgetOptions["interval"];
  auto_save_delay: ChartingLibraryWidgetOptions["auto_save_delay"];

  // BEWARE: no trailing slash is expected in feed URL
  datafeedUrl: string;
  libraryPath: ChartingLibraryWidgetOptions["library_path"];
  chartsStorageUrl: ChartingLibraryWidgetOptions["charts_storage_url"];
  chartsStorageApiVersion: ChartingLibraryWidgetOptions["charts_storage_api_version"];
  clientId: ChartingLibraryWidgetOptions["client_id"];
  userId: ChartingLibraryWidgetOptions["user_id"];
  fullscreen: ChartingLibraryWidgetOptions["fullscreen"];
  autosize: ChartingLibraryWidgetOptions["autosize"];
  studiesOverrides: ChartingLibraryWidgetOptions["studies_overrides"];
  containerId: ChartingLibraryWidgetOptions["container_id"];
  theme: string;
  timeframe: ChartingLibraryWidgetOptions["timeframe"];
}

export interface ChartContainerState {}

const TVChartContainer = ({
  tokenId,
  tokenSymbol,
  poolId,
}: {
  tokenId: string;
  tokenSymbol: string;
  poolId: string;
}) => {
  let datafeed = useTvDataFeed(tokenId, tokenSymbol, poolId);
  let resolution = window.localStorage.getItem("resolution") ?? "1s";


  const defaultProps: ChartContainerProps = {
    symbol: tokenSymbol,
    //@ts-ignore
    interval: 1,
    auto_save_delay: 5,
    theme: "Dark",
    containerId: "tv_chart_container",
    libraryPath: "/static/chart_library/",
    tokenId: tokenId,
    
    chartsStorageApiVersion: "1.1",
    clientId: "tradingview.com",
    userId: "public_user_id",
    fullscreen: false,
    autosize: true,
    studiesOverrides: {},
    timeframe: "1D",
  };

  const tvWidgetRef = React.useRef<IChartingLibraryWidget | null>(null);

  const chartProperties = JSON.parse(
    localStorage.getItem("chartproperties") || "{}"
  );

  React.useEffect(() => {
    const savedProperties = flatten(chartProperties, {
      restrictTo: ["scalesProperties", "paneProperties", "tradingProperties"],
    });

    const widgetOptions: ChartingLibraryWidgetOptions = {
      symbol: tokenSymbol,
      datafeed: datafeed,

      container_id:
        defaultProps.containerId as ChartingLibraryWidgetOptions["container_id"],
      library_path: defaultProps.libraryPath as string,
      auto_save_delay: 5,
      locale: "en",
      has_seconds: true,
      debug: false,
      seconds_multipliers: [1],
      disabled_features: ["use_localstorage_for_settings"],
      enabled_features: ["study_templates"],
      load_last_chart: true,
      client_id: defaultProps.clientId,
      user_id: defaultProps.userId,
      fullscreen: defaultProps.fullscreen,
      autosize: defaultProps.autosize,
      studies_overrides: defaultProps.studiesOverrides,
      supports_marks: true,
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
    ],      allow_symbol_change: false,
      interval: '1s',
      seconds_resolution: 1,
      theme: "Dark",
      overrides: {
        ...savedProperties,
        "mainSeriesProperties.candleStyle.upColor": "rgb(54, 116, 217)",
        "mainSeriesProperties.candleStyle.downColor": "rgb(225, 50, 85)",
        "mainSeriesProperties.candleStyle.borderUpColor": "rgb(54, 116, 217)",
        "mainSeriesProperties.candleStyle.borderDownColor": "rgb(225, 50, 85)",
        "mainSeriesProperties.candleStyle.wickUpColor": "rgb(54, 116, 217)",
        "mainSeriesProperties.candleStyle.wickDownColor": "rgb(225, 50, 85)",
        "paneProperties.backgroundGradientStartColor": "rgba(0,0,0,0)",
        "paneProperties.backgroundGradientEndColor":  "rgba(0,0,0,0)",
        
      },
      wickUpColor: "rgb(54, 116, 217)",
      upColor: "rgb(54, 116, 217)",
      wickDownColor: "rgb(225, 50, 85)",
      downColor: "rgb(225, 50, 85)",
      borderVisible: false,

      // @ts-ignore
      save_load_adapter: saveLoadAdapter,
      supports_timescale_marks: true,
      settings_adapter: {
        initialSettings: {
          "trading.orderPanelSettingsBroker": JSON.stringify({
            showRelativePriceControl: false,
            showCurrencyRiskInQty: false,
            showPercentRiskInQty: false,
            showBracketsInCurrency: false,
            showBracketsInPercent: false,
          }),
          // "proterty"
          "trading.chart.proterty":
            localStorage.getItem("trading.chart.proterty") ||
            JSON.stringify({
              hideFloatingPanel: 1,
            }),
          "chart.favoriteDrawings":
            localStorage.getItem("chart.favoriteDrawings") ||
            JSON.stringify([]),
          "chart.favoriteDrawingsPosition":
            localStorage.getItem("chart.favoriteDrawingsPosition") ||
            JSON.stringify({}),
        },
        setValue: (key, value) => {
          localStorage.setItem(key, value);
        },
        removeValue: (key) => {
          localStorage.removeItem(key);
        },
      },
    };

    const tvWidget = new widget(widgetOptions);
    window.inst = tvWidget;

    tvWidget.onChartReady(() => {
      tvWidgetRef.current = tvWidget;
      tvWidget
        // @ts-ignore
        .subscribe("onAutoSaveNeeded", () => tvWidget.saveChartToServer());
    });
  }, [tokenSymbol]);
  return (
    <Card className="h-[29rem] sm:w-[50rem] overflow-hidden p-2" style={{colorScheme: 'dark'}}>
      <div id={"TVChartContainer"} className={"TVChartContainer "} />
    </Card>
  );
};

export default TVChartContainer;
