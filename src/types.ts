export type Key = number | string

export type AsyncState<T> =
  // initial
  | { isReady: false; isLoading: false; error: null; result: undefined }
  // ready
  | { isReady: true; isLoading: false; error: null; result: T }
  // loading
  | { isReady: boolean; isLoading: true; error: Error | null; result?: T }
  // error
  | { isReady: false; isLoading: false; error: Error; result?: T }

export type Context = { isServer: boolean }
export type Fetcher<T> = (key: Key, context: Context) => Promise<T> | T
