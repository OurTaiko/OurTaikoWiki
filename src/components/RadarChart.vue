<script setup lang="ts">
import { onMounted, onUnmounted, watch, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'

interface Props {
  labels: string[]
  values: number[]
}

const props = defineProps<Props>()
const { locale } = useI18n()
const canvasRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

// 注册Chart.js插件
Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, ChartDataLabels)

const createChart = () => {
  if (!canvasRef.value) return

  // 销毁旧实例
  if (chartInstance) {
    chartInstance.destroy()
  }

  const minVal = Math.min(...props.values) - 1

  chartInstance = new Chart(canvasRef.value, {
    type: 'radar',
    data: {
      labels: props.labels,
      datasets: [{
        data: props.values,
        backgroundColor: 'rgba(233, 30, 99, 0.2)',
        borderColor: 'rgba(233, 30, 99, 1)',
        borderWidth: 2,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#e91e63'
      }]
    },
    options: {
      layout: {
        padding: 0
      },
      scales: {
        r: {
          suggestedMin: minVal > 0 ? minVal : 0,
          pointLabels: {
            padding: 20,
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            display: true,
            backdropColor: 'transparent',
            stepSize: 1,
            callback: (value: number | string) => Number(value).toFixed(0)
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        datalabels: {
          anchor: 'end',
          align: 'end',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderRadius: 4,
          padding: 2,
          formatter: (value: number) => Number(value).toFixed(2),
          font: {
            size: 14,
            weight: 'bold'
          },
          color: '#e91e63'
        }
      },
      responsive: true,
      maintainAspectRatio: false
    }
  })
}

onMounted(() => {
  createChart()
})

watch([() => props.values, () => props.labels, locale], () => {
  createChart()
}, { deep: true })

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy()
  }
})
</script>

<template>
  <canvas ref="canvasRef"></canvas>
</template>
