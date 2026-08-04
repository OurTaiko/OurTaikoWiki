<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

interface FaqItem {
  id: number
  question: string
  answer: string
}

const faqs = ref<FaqItem[]>([])
const loading = ref(true)
const expandedId = ref<number | null>(null)

const loadFaqs = async () => {
  try {
    const lang = locale.value
    const mod = await import(`@/data/faq/${lang}.json`)
    faqs.value = mod.default as FaqItem[]
  } catch {
    faqs.value = []
  } finally {
    loading.value = false
  }
}

const toggleExpand = (id: number) => {
  expandedId.value = expandedId.value === id ? null : id
}

loadFaqs()
</script>

<template>
  <div class="faq-page ffxiv-ui__workspace">
    <!-- Header -->
    <div class="text-center mb-10">
      <h1 class="text-3xl md:text-4xl font-bold text-[#1D1D1F] tracking-tight">FAQ</h1>
      <p class="text-[#86868B] mt-3 text-base">{{ locale === 'zh' ? '常见问题解答' : 'Frequently Asked Questions' }}</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="w-6 h-6 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin"></div>
    </div>

    <!-- Empty -->
    <div v-else-if="!faqs.length" class="text-center py-20 text-[#86868B]">
      {{ locale === 'zh' ? '暂无内容' : 'No content available' }}
    </div>

    <!-- FAQ List -->
    <div v-else class="faq-list space-y-3">
      <div
        v-for="(item, index) in faqs"
        :key="item.id"
        class="faq-item"
        :style="{ animationDelay: `${index * 50}ms` }"
      >
        <button
          @click="toggleExpand(item.id)"
          class="faq-question w-full text-left"
          :aria-expanded="expandedId === item.id"
        >
          <span class="faq-number">{{ String(item.id).padStart(2, '0') }}</span>
          <span class="faq-q-text">{{ item.question }}</span>
          <i
            class="fas fa-chevron-down faq-chevron"
            :class="{ 'faq-chevron--open': expandedId === item.id }"
          ></i>
        </button>
        <Transition name="faq-expand">
          <div v-if="expandedId === item.id" class="faq-answer">
            <p>{{ item.answer }}</p>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.faq-page {
  max-width: 780px;
  margin: 0 auto;
}

/* FAQ list entrance animation */
.faq-list {
  animation: faqFadeIn 0.5s ease both;
}

@keyframes faqFadeIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* FAQ item */
.faq-item {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.3s ease, transform 0.3s ease;
  animation: faqItemIn 0.4s ease both;
}

.faq-item:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

@keyframes faqItemIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Question button */
.faq-question {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  cursor: pointer;
  transition: background 0.2s ease;
  border: none;
  background: transparent;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}

.faq-question:hover {
  background: rgba(0, 122, 255, 0.03);
}

.faq-question:active {
  transform: scale(0.995);
}

/* Number badge */
.faq-number {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: #007AFF;
  background: rgba(0, 122, 255, 0.08);
  min-width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  letter-spacing: -0.02em;
}

/* Question text */
.faq-q-text {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: #1D1D1F;
  line-height: 1.5;
}

/* Chevron icon */
.faq-chevron {
  flex-shrink: 0;
  font-size: 12px;
  color: #C7C7CC;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s ease;
}

.faq-chevron--open {
  transform: rotate(180deg);
  color: #007AFF;
}

/* Answer area */
.faq-answer {
  padding: 0 20px 20px 66px;
  color: #6E6E73;
  font-size: 14px;
  line-height: 1.75;
}

.faq-answer p {
  margin: 0;
}

/* Expand/collapse transition */
.faq-expand-enter-active {
  animation: faqSlideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.faq-expand-leave-active {
  animation: faqSlideDown 0.2s cubic-bezier(0.4, 0, 0.2, 1) reverse;
}

@keyframes faqSlideDown {
  from {
    opacity: 0;
    max-height: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    max-height: 300px;
    transform: translateY(0);
  }
}
</style>
