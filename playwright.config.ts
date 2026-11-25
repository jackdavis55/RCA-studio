import {defineConfig} from '@playwright/test'
export default defineConfig({
  testDir:'e2e',fullyParallel:true,workers:2,
  use:{baseURL:'http://127.0.0.1:4173',browserName:'chromium',trace:'retain-on-failure'},
  webServer:{command:'npm run start -- --listen tcp://127.0.0.1:4173',url:'http://127.0.0.1:4173',reuseExistingServer:false},
})
