export interface Trade {
    tx: string
    amount: number
    priceUsd: number
    volume: number
    type: string
    wallet: string
    time: number
    program: string
    ownerReduced: string
    total_invested?: number
    token: string
    walletType: string
}

export interface WalletTrade {
    tx: string
    from: TradeItem
    to: TradeItem
    price: Price
    volume: Volume
    wallet: string
    program: string
    time: number
    ownerReduced: string
  }
  
  export interface TradeToken {
    name: string
    symbol: string
    image: string
    decimals: number
  }

  export interface TradeItem {
    address: string
    amount: number
    token: TradeToken
  }
  
  export interface Price {
    usd: number
    sol: string
  }
  
  export interface Volume {
    usd: number
    sol: number
  }
  