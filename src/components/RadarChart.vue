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
        backgroundColor: 'rgba(214, 184, 93, 0.18)',
        borderColor: '#d4c4a6',
        borderWidth: 2,
        pointBackgroundColor: '#303030',
        pointBorderColor: '#f4e5b2',
        pointHoverBackgroundColor: '#f4e5b2',
        pointHoverBorderColor: '#303030'
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
            color: '#cccabf',
            padding: 20,
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            display: true,
            color: '#ae9b89',
            backdropColor: 'transparent',
            stepSize: 1,
            callback: (value: number | string) => Number(value).toFixed(0)
          },
          angleLines: {
            color: 'rgba(212, 196, 166, 0.2)'
          },
          grid: {
            color: 'rgba(204, 202, 191, 0.14)'
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
          backgroundColor: 'rgba(48, 48, 48, 0.9)',
          borderColor: 'rgba(212, 196, 166, 0.55)',
          borderWidth: 1,
          borderRadius: 4,
          padding: 2,
          formatter: (value: number) => Number(value).toFixed(2),
          font: {
            size: 14,
            weight: 'bold'
          },
          color: '#f4e5b2'
        },
        tooltip: {
          backgroundColor: 'rgba(35, 34, 33, 0.96)',
          borderColor: '#8e7d62',
          borderWidth: 1,
          titleColor: '#e5e0d5',
          bodyColor: '#cccabf'
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
