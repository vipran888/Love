// 维格云 API 代理配置
// 前端不再直接访问 vika.cn，也不再持有 API Token。
// 所有请求经由同源 Worker 代理 /api/vika/*，Token 由服务端注入。
const WIKI_CLOUD_API = '/api/vika';

// 只保留表格 ID 与视图 ID（这两项不敏感，可公开）
let CONFIG_DATASHEET_ID = import.meta.env.VITE_WIKI_CLOUD_DATASHEET_ID || ''
let CONFIG_VIEW_ID = import.meta.env.VITE_WIKI_CLOUD_VIEW_ID || ''

// 兼容旧的 config.json（只读取表 ID，不再读取 API Key）
async function loadConfigFromFile() {
  try {
    const response = await fetch('/config.json')
    if (response.ok) {
      const config = await response.json()
      CONFIG_DATASHEET_ID = config.wikiCloudDatasheetId || CONFIG_DATASHEET_ID
      CONFIG_VIEW_ID = config.wikiCloudViewId || CONFIG_VIEW_ID
      console.log('从 config.json 加载表格配置成功')
    }
  } catch (error) {
    console.warn('从 config.json 加载表格配置失败:', error)
  }
}

// 确保配置加载
const configLoadedPromise = loadConfigFromFile()

/**
 * 统一请求封装
 * @param {string} path 例如 /datasheets/dstxxx/records?viewId=viwxxx
 * @param {object} options fetch 选项
 */
async function vikaFetch(path, options = {}) {
  const url = `${WIKI_CLOUD_API}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API 请求失败: ${res.status} ${res.statusText} ${text.slice(0, 200)}`)
  }
  return res
}

/**
 * 缓存管理工具
 */
const cacheManager = {
  // 连续刷新的时间阈值（毫秒）
  CONTINUOUS_REFRESH_THRESHOLD: 5000, // 5秒内算连续刷新

  /**
   * 获取缓存数据
   * @param {string} key - 缓存键名
   * @returns {Object|null} 缓存数据或null
   */
  getCache(key) {
    try {
      const cacheItem = localStorage.getItem(key)
      if (!cacheItem) return null
      return JSON.parse(cacheItem)
    } catch (error) {
      console.error('读取缓存失败:', error)
      return null
    }
  },

  /**
   * 设置缓存数据
   * @param {string} key - 缓存键名
   * @param {*} data - 要缓存的数据
   */
  setCache(key, data) {
    try {
      const now = new Date().getTime()
      const cacheItem = {
        data,
        timestamp: now,
        refreshCount: 0,
        lastAccessTime: now,
      }
      localStorage.setItem(key, JSON.stringify(cacheItem))
    } catch (error) {
      console.error('写入缓存失败:', error)
    }
  },

  /**
   * 检查缓存是否有效（默认 10 分钟）
   */
  isCacheValid(key, maxAge = 10 * 60 * 1000) {
    const item = this.getCache(key)
    if (!item) return false
    return Date.now() - item.timestamp < maxAge
  },

  /**
   * 更新访问信息，返回是否需要强制刷新
   */
  updateAccessInfo(key) {
    try {
      const item = this.getCache(key)
      if (!item) return true
      const now = Date.now()
      const isContinuous = now - (item.lastAccessTime || 0) < this.CONTINUOUS_REFRESH_THRESHOLD
      item.refreshCount = isContinuous ? (item.refreshCount || 0) + 1 : 0
      item.lastAccessTime = now
      localStorage.setItem(key, JSON.stringify(item))
      return item.refreshCount >= 2
    } catch (error) {
      console.error('更新访问信息失败:', error)
      return true
    }
  },

  clear(key) {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error('清除缓存失败:', error)
    }
  },
}

/**
 * 从维格云表格获取配置
 * @returns {Promise<Object>} 配置对象
 */
export async function getConfigFromWikiCloud() {
  const cacheKey = 'wiki_cloud_config'

  if (cacheManager.isCacheValid(cacheKey)) {
    const needRefresh = cacheManager.updateAccessInfo(cacheKey)
    if (!needRefresh) {
      const cachedData = cacheManager.getCache(cacheKey)
      return cachedData.data
    }
  }

  try {
    await configLoadedPromise

    if (!CONFIG_DATASHEET_ID) {
      throw new Error('缺少 CONFIG_DATASHEET_ID 配置')
    }

    const query = CONFIG_VIEW_ID ? `?viewId=${CONFIG_VIEW_ID}` : ''
    const response = await vikaFetch(`/datasheets/${CONFIG_DATASHEET_ID}/records${query}`)
    const data = await response.json()

    // 表格结构：Settings 列为设置项，value 列为值
    const config = data.data.records.reduce((acc, record) => {
      if (record.fields && record.fields.Settings && record.fields.value !== undefined) {
        acc[record.fields.Settings] = record.fields.value
      }
      return acc
    }, {})

    cacheManager.setCache(cacheKey, config)
    return config
  } catch (error) {
    console.error('从维格云表格获取配置失败:', error)

    const cachedData = cacheManager.getCache(cacheKey)
    if (cachedData) {
      cacheManager.updateAccessInfo(cacheKey)
      return cachedData.data
    }

    return {
      loveDate: '2023-01-15',
      weddingDay: '2015-03-03',
      dailyQuote: '爱你每一天',
    }
  }
}

/**
 * 解析表格配置字符串
 * 现在只需 datasheetId 与 viewId（Token 由服务端注入）
 * 兼容旧格式 "apiKey,datasheetId,viewId"：忽略第一段
 * @param {string} configString
 * @returns {{datasheetId:string, viewId:string}|null}
 */
function parseSheetConfig(configString) {
  if (!configString) return null

  const parts = String(configString).split(',').map((s) => s.trim())

  // 新格式：dst,viw
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { datasheetId: parts[0], viewId: parts[1] }
  }

  // 旧格式：apiKey,dst,viw —— 忽略第一段
  if (parts.length >= 3) {
    const [, datasheetId, viewId] = parts
    if (datasheetId) return { datasheetId, viewId: viewId || '' }
  }

  // 只有一段时当作 datasheetId
  if (parts.length === 1 && parts[0]) {
    return { datasheetId: parts[0], viewId: '' }
  }

  return null
}

/**
 * 从维格云表格获取爱情清单数据
 * @returns {Promise<Array>} 爱情清单数组
 */
export async function getLoveListFromWikiCloud() {
  const cacheKey = 'wiki_cloud_love_list'

  if (cacheManager.isCacheValid(cacheKey)) {
    const cachedData = cacheManager.getCache(cacheKey)
    if (cachedData) return cachedData.data
  }

  try {
    const config = await getConfigFromWikiCloud()
    const loveListConfig = parseSheetConfig(config['love-list'])

    if (!loveListConfig) {
      throw new Error('爱情清单表格配置无效')
    }

    const query = loveListConfig.viewId ? `?viewId=${loveListConfig.viewId}` : ''
    const response = await vikaFetch(`/datasheets/${loveListConfig.datasheetId}/records${query}`)
    const data = await response.json()

    const loveList = data.data.records.map((record) => ({
      id: record.recordId,
      list: record.fields.list || '',
      todo:
        record.fields.todo === true ||
        record.fields.todo === 'ture' ||
        record.fields.todo === 'true' ||
        record.fields.todo === 'yes',
    }))

    cacheManager.setCache(cacheKey, loveList)
    return loveList
  } catch (error) {
    console.error('获取爱情清单失败:', error)
    return []
  }
}

/**
 * 从维格云表格获取相册数据
 * @returns {Promise<Array>} 照片数组
 */
export async function getGalleryPhotosFromWikiCloud() {
  const cacheKey = 'wiki_cloud_gallery'

  if (cacheManager.isCacheValid(cacheKey)) {
    const cachedData = cacheManager.getCache(cacheKey)
    if (cachedData) return cachedData.data
  }

  try {
    const config = await getConfigFromWikiCloud()
    const photoConfig = parseSheetConfig(config['photo'])

    if (!photoConfig) {
      throw new Error('相册表格配置无效')
    }

    const query = photoConfig.viewId ? `?viewId=${photoConfig.viewId}` : ''
    const response = await vikaFetch(`/datasheets/${photoConfig.datasheetId}/records${query}`)
    const data = await response.json()

    const galleryPhotos = data.data.records
      .map((record) => {
        let image = record.fields.imge
        if (Array.isArray(image) && image.length > 0) {
          image = image[0].url
        } else if (typeof image === 'object' && image !== null) {
          image = image.url || ''
        }
        let category = record.fields.category || '日常'
        return {
          id: record.recordId,
          image: image || '',
          category,
          description: record.fields.description || '',
        }
      })
      .filter((p) => p.image)

    cacheManager.setCache(cacheKey, galleryPhotos)
    return galleryPhotos
  } catch (error) {
    console.error('获取相册失败:', error)
    return []
  }
}

/**
 * 从维格云表格获取幸福路（时间线）数据
 * @returns {Promise<Array>}
 */
export async function getTimelineFromWikiCloud() {
  const cacheKey = 'wiki_cloud_timeline'

  if (cacheManager.isCacheValid(cacheKey)) {
    const cachedData = cacheManager.getCache(cacheKey)
    if (cachedData) return cachedData.data
  }

  try {
    const config = await getConfigFromWikiCloud()
    const timelineConfig = parseSheetConfig(config['timeline'])

    if (!timelineConfig) {
      throw new Error('时间线表格配置无效')
    }

    const query = timelineConfig.viewId ? `?viewId=${timelineConfig.viewId}` : ''
    const response = await vikaFetch(`/datasheets/${timelineConfig.datasheetId}/records${query}`)
    const data = await response.json()

    const timeline = data.data.records.map((record) => {
      let image = record.fields.img
      if (Array.isArray(image) && image.length > 0) {
        image = image[0].url
      } else if (typeof image === 'object' && image !== null) {
        image = image.url || ''
      }
      return {
        id: record.recordId,
        date: record.fields.date || '',
        title: record.fields.title || '',
        description: record.fields.text || '',
        image: image || '',
      }
    })

    cacheManager.setCache(cacheKey, timeline)
    return timeline
  } catch (error) {
    console.error('获取时间线失败:', error)
    return []
  }
}

/**
 * 从维格云表格获取点点滴滴数据
 * @returns {Promise<Array>}
 */
export async function getMomentsFromWikiCloud() {
  const cacheKey = 'wiki_cloud_moments'

  if (cacheManager.isCacheValid(cacheKey)) {
    const cachedData = cacheManager.getCache(cacheKey)
    if (cachedData) return cachedData.data
  }

  try {
    const config = await getConfigFromWikiCloud()
    const momentsConfig = parseSheetConfig(config['moments'])

    if (!momentsConfig) {
      throw new Error('点点滴滴表格配置无效')
    }

    const query = momentsConfig.viewId ? `?viewId=${momentsConfig.viewId}` : ''
    const response = await vikaFetch(`/datasheets/${momentsConfig.datasheetId}/records${query}`)
    const data = await response.json()

    const moments = data.data.records.map((record) => {
      let image = record.fields.img
      if (Array.isArray(image) && image.length > 0) {
        image = image[0].url
      } else if (typeof image === 'object' && image !== null) {
        image = image.url || ''
      }
      return {
        id: record.recordId,
        date: record.fields.date || '',
        title: record.fields.title || '',
        content: record.fields.text || '',
        image: image || '',
      }
    })

    cacheManager.setCache(cacheKey, moments)
    return moments
  } catch (error) {
    console.error('获取点点滴滴失败:', error)
    return []
  }
}

/**
 * 计算恋爱天数
 */
export function calculateLoveDays(loveDate) {
  if (!loveDate) return 0
  const start = new Date(loveDate)
  if (Number.isNaN(start.getTime())) return 0
  const days = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, days)
}

/**
 * 从维格云表格获取留言
 * @returns {Promise<Array>}
 */
export async function getMessagesFromWikiCloud() {
  const cacheKey = 'wiki_cloud_messages'

  if (cacheManager.isCacheValid(cacheKey)) {
    const cachedData = cacheManager.getCache(cacheKey)
    if (cachedData) return cachedData.data
  }

  try {
    const config = await getConfigFromWikiCloud()
    const messageConfig = parseSheetConfig(config['message'])

    if (!messageConfig) {
      throw new Error('留言板表格配置无效')
    }

    const query = messageConfig.viewId ? `?viewId=${messageConfig.viewId}` : ''
    const response = await vikaFetch(`/datasheets/${messageConfig.datasheetId}/records${query}`)
    const data = await response.json()

    const messages = data.data.records
      .map((record) => ({
        id: record.recordId,
        nickname: record.fields.nickname || '',
        email: record.fields.email || '',
        content: record.fields.content || '',
        avatar: record.fields.avatar || '',
        ip: record.fields.ipAddress || '',
        userAgent: record.fields.userAgent || '',
        createTime: record.fields.createTime || '',
        isApproved: record.fields.isApproved || '是',
        blog: record.fields.blog || '',
      }))
      .filter((m) => m.isApproved === '是')

    messages.sort((a, b) => new Date(b.createTime || 0) - new Date(a.createTime || 0))

    cacheManager.setCache(cacheKey, messages)
    return messages
  } catch (error) {
    console.error('获取留言失败:', error)
    return []
  }
}

/**
 * 提交留言
 * @param {object} messageData
 */
export async function submitMessageToWikiCloud(messageData) {
  const config = await getConfigFromWikiCloud()
  const messageConfig = parseSheetConfig(config['message'])

  if (!messageConfig) {
    throw new Error('留言板表格配置无效')
  }

  const submitData = {
    records: [
      {
        fields: {
          nickname: messageData.nickname,
          email: messageData.email,
          content: messageData.content,
          avatar: messageData.avatar,
          ipAddress: messageData.ip,
          userAgent: messageData.userAgent,
          createTime: new Date().toISOString(),
          isApproved: '是',
          blog: messageData.blog || '',
        },
      },
    ],
  }

  const response = await vikaFetch(`/datasheets/${messageConfig.datasheetId}/records`, {
    method: 'POST',
    body: JSON.stringify(submitData),
  })

  // 提交成功后清空缓存，让下次读取拿到新数据
  cacheManager.clear('wiki_cloud_messages')

  return response.json()
}
