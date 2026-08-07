import type { V1Song, V2SongMap } from '../types'

const V1_URL = 'https://cdn.ourtaiko.org/api/fumendb_constants'
export const V2_CONSTANTS_URL = 'https://cdn.ourtaiko.org/api/gugu_constants'

let v1Promise: Promise<Map<number, V1Song>> | undefined
const v2UrlPromises = new Map<string, Promise<V2SongMap>>()

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`定数数据请求失败（HTTP ${response.status}）`)
  return response.json() as Promise<T>
}

export function loadV1Constants(): Promise<Map<number, V1Song>> {
  v1Promise ??= requestJson<V1Song[]>(V1_URL).then(
    (items) => new Map(items.map((item) => [Number(item.id), item])),
  )
  return v1Promise
}

export function loadV2Constants(): Promise<V2SongMap> {
  return loadV2ConstantsFrom(V2_CONSTANTS_URL)
}

export function loadV2ConstantsFrom(url: string): Promise<V2SongMap> {
  const normalized = url.trim()
  if (!normalized) return Promise.reject(new Error('请输入 API 地址'))
  let promise = v2UrlPromises.get(normalized)
  if (!promise) {
    promise = requestJson<V2SongMap>(normalized)
    v2UrlPromises.set(normalized, promise)
  }
  return promise
}
