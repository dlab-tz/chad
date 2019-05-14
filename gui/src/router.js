import Vue from "vue";
import Router from "vue-router";
import {store} from './store.js'
import VueCookies from 'vue-cookies'
import AddCHA from '@/components/AddCHA.vue'
import AddHFS from '@/components/AddHFS.vue'
import AddRegion from '@/components/Location/AddRegion.vue'
import AddDistrict from '@/components/Location/AddDistrict.vue'
import AddFacility from '@/components/Location/AddFacility.vue'
import AddVillage from '@/components/Location/AddVillage.vue'
import Logout from '@/components/Logout.vue'
import Login from '@/components/Login.vue'
import UsersList from '@/components/UsersList.vue'
import AddUser from '@/components/AddUser.vue'
import ChangePassword from '@/components/ChangePassword.vue'

Vue.use(Router);

let router = new Router({
  routes: [
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
    },
  ]
});

router.beforeEach((to, from, next) => {
  if (!store.state.auth.token && (!VueCookies.get('token') || !VueCookies.get('userID'))) {
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