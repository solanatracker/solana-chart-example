export interface iToken {
    token: Token
    pools: Pool[]
    events: any
    balance?: number
    value?: number
    position?: Position
    risk: RiskScore
}

export interface Txns {
  buys: number
  sells: number
  total: number
  volume: number
}


export interface Token {
    name: string
    symbol: string
    mint: string
    uri: string
    decimals: number
    description: string
    image: string
    showName?: boolean
    createdOn?: string
    twitter?: string
    telegram?: string
    website?: string
    discord?: string
    hasFileMetaData: boolean
    extensions?: any
}

export interface Pool {
    createdAt: number
    poolId: string
    liquidity: Liquidity
    price: Price
    tokenSupply: number
    lpBurn: number
    tokenAddress: string
    marketCap: MarketCap
    decimals: number
    security: Security
    quoteToken: string
    market: string
    openTime?: number
    deployer?: string
    txns: Txns
}

export interface Liquidity {
    quote: number
    usd: number
}

export interface Price {
    quote: number
    usd: number
}

export interface MarketCap {
    quote: number
    usd: number
}

export interface Security {
    freezeAuthority: null | string
    mintAuthority: null | string
}

export interface Events {
    "5m": Interval
    "30m": Interval
    "1h": Interval
    "3h": Interval
    "6h": Interval
    "12h": Interval
    "24h": Interval
  }
  
  
  export interface Interval {
    buyers: number
    sellers: number
    volume: Volume
    transactions: number
    buys: number
    sells: number
    wallets: number
    price: number
    priceChangePercentage: number
  }
  
  export interface Volume {
    buys: number
    sells: number
    total: number
  }
  
  export interface Position {
    txid: string
    from: string
    to: string
    fromAmount: number
    toAmount: number
    fromPrice: number
    toPrice: number
    executionPrice: number
    slippage: number
    user: string
    created_at: string
    sell_date: any
    sell_pnl: any
    sell_profit_amount: any
    sell_price: any
    via: string
    sold_amount: any
    original_buy_amount: any
    handled_referral: number
    address: string
  }
  
  export interface RiskScore {
    rugged: boolean
    risks: Risk[]
    score: number
    jupiterVerified?: boolean
  }
  
  export interface Risk {
    name: string
    description: string
    level: string
    score: number
    value?: string
    jupiterVerified: boolean
  }