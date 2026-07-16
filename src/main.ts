import { createApp } from 'vue'
import { Capacitor } from '@capacitor/core'
import './style.scss'
import App from './App.vue'

document.documentElement.classList.toggle('native-app', Capacitor.isNativePlatform())

createApp(App).mount('#app')
