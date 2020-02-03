import Vue from 'vue'
import Router from 'vue-router'
import {
  store
} from './store.js'
import VueCookies from 'vue-cookies'
import Dashboard from '@/components/Dashboard.vue'
import AddCHA from '@/components/AddCHA.vue'
import AddHFS from '@/components/AddHFS.vue'
import AddRegion from '@/components/Location/AddRegion.vue'
import AddDistrict from '@/components/Location/AddDistrict.vue'
import AddFacility from '@/components/Location/AddFacility.vue'
import AddVillage from '@/components/Location/AddVillage.vue'
import RegionsReport from '@/components/Reports/Location/Regions.vue'
import DistrictsReport from '@/components/Reports/Location/Districts.vue'
import FacilitiesReport from '@/components/Reports/Location/Facilities.vue'
import VillagesReport from '@/components/Reports/Location/Villages.vue'
import CHAReport from '@/components/Reports/CHA.vue'
import HFSReport from '@/components/Reports/HFS.vue'
import SubmissionsReport from '@/components/Reports/SubmissionsReport.vue'
import Logout from '@/components/Logout.vue'
import Login from '@/components/Login.vue'
import UsersList from '@/components/UsersList.vue'
import AddUser from '@/components/AddUser.vue'
import ChangePassword from '@/components/ChangePassword.vue'

Vue.use(Router)

const router = new Router({
  routes: [{
      path: '/dashboard',
      name: 'Dashboard',
      component: Dashboard
    },
    {
      path: '/addCHA',
      name: 'AddCHA',
      component: AddCHA
    },
    {
      path: '/addHFS',
      name: 'AddHFS',
      component: AddHFS
    },
    {
      path: '/addRegion',
      name: 'AddRegion',
      component: AddRegion
    },
    {
      path: '/addDistrict',
      name: 'AddDistrict',
      component: AddDistrict
    },
    {
      path: '/addFacility',
      name: 'AddFacility',
      component: AddFacility
    },
    {
      path: '/addVillage',
      name: 'AddVillage',
      component: AddVillage
    },
    {
      path: '/addUser',
      name: 'AddUser',
      component: AddUser
    },
    {
      path: '/UsersList',
      name: 'UsersList',
      component: UsersList
    },
    {
      path: '/RegionsReport',
      name: 'RegionsReport',
      component: RegionsReport
    },
    {
      path: '/DistrictsReport',
      name: 'DistrictsReport',
      component: DistrictsReport
    },
    {
      path: '/FacilitiesReport',
      name: 'FacilitiesReport',
      component: FacilitiesReport
    },
    {
      path: '/VillagesReport',
      name: 'VillagesReport',
      component: VillagesReport
    },
    {
      path: '/CHAReport',
      name: 'CHAReport',
      component: CHAReport
    },
    {
      path: '/HFSReport',
      name: 'HFSReport',
      component: HFSReport
    },
    {
      path: '/SubmissionsReport',
      name: 'SubmissionsReport',
      component: SubmissionsReport
    },
    {
      path: '/ChangePassword',
      name: 'ChangePassword',
      component: ChangePassword
    },
    {
      path: '/Login',
      name: 'Login',
      component: Login
    },
    {
      path: '/Logout',
      name: 'Logout',
      component: Logout
    }
  ]
})

router.beforeEach((to, from, next) => {
  if (
    !store.state.auth.token &&
    (!VueCookies.get('token') || !VueCookies.get('userID'))
  ) {
    if (to.path !== '/Login') {
      next({
        path: '/Login'
      })
    } else {
      next()
    }
  } else {
    next()
  }
})

export default router
