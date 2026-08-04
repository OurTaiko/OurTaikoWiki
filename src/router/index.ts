import GuideView from '@views/GuideView.vue'
import ReportView from '@views/ReportView.vue'
import SongsView from '@views/SongsView.vue'
import FaqView from '@views/FaqView.vue'
import V2TestView from '@views/V2TestView.vue'
import V2FullRatingView from '@views/V2FullRatingView.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: GuideView
    },
    {
      path: '/report',
      name: 'report',
      component: ReportView
    },
    {
      path: '/songs',
      name: 'songs',
      component: SongsView
    },
    {
      path: '/faq',
      name: 'faq',
      component: FaqView
    },
    {
      path: '/v2test',
      name: 'v2test',
      component: V2TestView
    },
    {
      path: '/v2full',
      name: 'v2full',
      component: V2FullRatingView
    }
  ]
})

export default router
