<template>
  <footer class="py-6 mt-12">
    <div class="container mx-auto px-4">
      <div class="text-center">
        <!-- 版权信息 -->
        <div class="mb-4">
          <p class="text-1xl font-bold bg-gradient-to-r from-red-500 to-blue-500 bg-clip-text text-transparent">&copy; {{ footerCopyright }}</p>
          <p class="text-1xl bg-gradient-to-r from-red-500 to-blue-500 bg-clip-text text-transparent">已稳定运行 {{ days }} 天 {{ hours }} 小时 {{ minutes }} 分钟 {{ seconds }} 秒</p>
          <p class="text-1xl font-bold bg-gradient-to-r from-red-500 to-blue-500 bg-clip-text text-transparent"> {{ footerPoem }} </p>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { getConfigFromWikiCloud } from '../utils/api'

// ===== 可配置项（维格云「设置」表）=====
// footerCopyright  版权文字
// footerStartTime  运行计时起点，格式 2026-01-01 或 2026-01-01T00:00:00
// footerPoem       底部诗句/寄语

// 默认值（维格云未配置时使用）
const DEFAULT_COPYRIGHT = '水常和萍之六的爱情小站💝'
const DEFAULT_START_TIME = '2026-01-01T00:00:00'
const DEFAULT_POEM = '❤️月亮被嚼碎变成了星星，你就藏在这满天的星光里✨💘'

const footerCopyright = ref(DEFAULT_COPYRIGHT)
const footerPoem = ref(DEFAULT_POEM)

// 起始时间（可被维格云覆盖）
let startTime = new Date(DEFAULT_START_TIME)

// 运行时间
const days = ref(0)
const hours = ref(0)
const minutes = ref(0)
const seconds = ref(0)

// 定时器
let timer = null

// 计算运行时间
const calculateRunningTime = () => {
  const now = new Date()
  const diff = now - startTime

  // 起始时间在未来时，显示 0，避免负数
  if (diff < 0) {
    days.value = 0
    hours.value = 0
    minutes.value = 0
    seconds.value = 0
    return
  }

  days.value = Math.floor(diff / (1000 * 60 * 60 * 24))
  hours.value = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  minutes.value = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  seconds.value = Math.floor((diff % (1000 * 60)) / 1000)
}

/**
 * 解析起始时间，兼容 2026-01-01 与 2026-01-01T00:00:00
 * 无效则返回 null
 */
const parseStartTime = (str) => {
  if (!str) return null
  const s = String(str).trim()
  if (!s) return null
  // 纯日期补上时间部分，避免部分浏览器按 UTC 解析导致偏移
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

// 组件挂载时开始计时
onMounted(async () => {
  // 先按默认值跑起来，避免等待接口时显示 0
  calculateRunningTime()
  timer = setInterval(calculateRunningTime, 1000)

  // 从维格云读取三项配置
  try {
    const cfg = await getConfigFromWikiCloud()
    if (!cfg) return

    if (cfg.footerCopyright) {
      footerCopyright.value = String(cfg.footerCopyright)
    }
    if (cfg.footerPoem) {
      footerPoem.value = String(cfg.footerPoem)
    }
    if (cfg.footerStartTime) {
      const parsed = parseStartTime(cfg.footerStartTime)
      if (parsed) {
        startTime = parsed
        calculateRunningTime()
      } else {
        console.warn('footerStartTime 格式无效，已使用默认值:', cfg.footerStartTime)
      }
    }
  } catch (error) {
    console.warn('页脚配置读取失败，使用默认值:', error)
  }
})

// 组件卸载时清除定时器
onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<style scoped>
/* Footer组件样式 */
</style>
