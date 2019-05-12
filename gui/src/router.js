import Vue from "vue";
import Router from "vue-router";
import {store} from './store.js'
import VueCookies from 'vue-cookies'
import Logout from '@/components/Logout.vue'
import Login from '@/components/Login.vue'
import UsersList from '@/components/UsersList.vue'
import AddUser from '@/components/AddUser.vue'
import ChangePassword from '@/components/ChangePassword.vue'

Vue.use(Router);

let router = new Router({
  routes: [
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