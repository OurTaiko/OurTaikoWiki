import type { V1Song, V2SongMap } from '../types'

const V1_URL = 'https://cdn.ourtaiko.org/api/fumendb_constants'
const V2_URL = 'https://cdn.ourtaiko.org/api/gugu_constants'

let v1Promise: Promise<Map<number, V1Song>> | undefined
let v2Promise: Promise<V2SongMap> | undefined

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
  v2Promise ??= requestJson<V2SongMap>(V2_URL)
  return v2Promise
}
