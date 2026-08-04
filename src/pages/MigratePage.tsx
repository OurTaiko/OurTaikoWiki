import { useEffect } from 'react'
import { applyMigratedData } from '../utils/legacyMigration'

/**
 * 接收旧域名跳转带来的迁移数据：
 * https://wiki.ourtaiko.org/migrate#data=<btoa(encodeURIComponent(JSON))>
 * 解码写入 localStorage 后清除地址栏数据并回到首页。
 */
export function MigratePage() {
  useEffect(() => {
    const params = new URLSearchParams(location.hash.slice(1))
    const encoded = params.get('data')

    if (encoded) {
      try {
        const data = JSON.parse(decodeURIComponent(atob(encoded)))
        applyMigratedData(data)
      } catch (error) {
        console.error('LocalStorage migration failed:', error)
      }
    }

    // 清除地址栏中的迁移数据
    history.replaceState(null, '', '/')
    // 重新加载应用，让 WikiContext 从 localStorage 读取迁移后的数据
    location.replace('/')
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center' }}>
      <p>正在迁移旧版数据…</p>
    </div>
  )
}
