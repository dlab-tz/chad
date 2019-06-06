<template>
  <v-container>
    <v-layout
      row
      wrap>
      <v-spacer/>
      <v-flex xs12>
        <v-alert
          style="width: 500px"
          v-model="alertSuccess"
          type="success"
          dismissible
          transition="scale-transition"
        >
          {{alertMsg}}
        </v-alert>
        <v-alert
          style="width: 500px"
          v-model="alertFail"
          type="error"
          dismissible
          transition="scale-transition"
        >
          {{alertMsg}}
        </v-alert>
        <v-card
          class="mx-auto"
          style="max-width: 1000px;">
          <v-system-bar
            color="deep-purple darken-4"
            dark/>
          <v-toolbar
            color="deep-purple accent-4"
            cards
            dark
            flat>
            <v-card-title class="title font-weight-regular">Add New Health Facility Supervisor</v-card-title>
          </v-toolbar>
          <v-form
            ref="form"
            class="pa-3 pt-4">
            <v-layout row wrap>
              <v-flex xs5>
                <v-text-field
                  required
                  @blur="$v.firstName.$touch()"
                  @change="$v.firstName.$touch()"
                  :error-messages="firstnameErrors"
                  v-model="firstName"
                  box
                  color="deep-purple"
                  label="First Name*"/>
                <v-text-field
                  v-model="otherName"
                  box
                  color="deep-purple"
                  label="Middle Names"/>
                <v-text-field
                  required
                  @blur="$v.surname.$touch()"
                  @change="$v.surname.$touch()"
                  :error-messages="surnameErrors"
                  v-model="surname"
                  box
                  color="deep-purple"
                  label="Surname*"/>
              </v-flex>
              <v-spacer></v-spacer>
              <v-flex xs5>
                <v-text-field
                  required
                  @blur="$v.phone1.$touch()"
                  @change="$v.phone1.$touch()"
                  :error-messages="phone1Errors"
                  v-model="phone1"
                  box
                  color="deep-purple"
                  label="Mobile Phone 1*"/>
                <v-text-field
                  v-model="phone2"
                  box
                  color="deep-purple"
                  label="Mobile Phone 2"/>
                <v-text-field
                  required
                  @blur="$v.email.$touch()"
                  @change="$v.email.$touch()"
                  :error-messages="emailErrors"
                  v-model="email"
                  box
                  color="deep-purple"
                  label="Email*"/>
                <v-treeview
                  :active.sync="active"
                  :open.sync="open"
                  :items="items"
                  :load-children="getLocation"
                  activatable
                  active-class="primary--text"
                  class="grey lighten-5"
                  open-on-click
                  transition
                >
                  <template v-slot:prepend="{ item, active }">
                    <v-icon
                      v-if="!item.children"
                      :color="active ? 'primary' : ''"
                    >
                      mdi-account
                    </v-icon>
                  </template>
                </v-treeview>
              </v-flex>
            </v-layout>
          </v-form>
          <v-divider/>
          <v-card-actions>
            <v-btn
              flat
              @click="$refs.form.reset()">
              <v-icon>clear</v-icon>Clear
            </v-btn>
            <v-spacer/>
            <v-btn
              @click="addHFS()"
              :disabled="$v.$invalid || active.length === 0"
              class="white--text"
              color="deep-purple accent-4"
              depressed><v-icon left>how_to_reg</v-icon>Add</v-btn>
          </v-card-actions>
        </v-card>
      </v-flex>
      <v-spacer/>
    </v-layout>
  </v-container>
</template>
<script>
import axios from 'axios'
import { required, email, integer, minLength, maxLength, minValue } from 'vuelidate/lib/validators'

const backendServer = process.env.VUE_APP_BACKEND_SERVER

export default {
  validations: {
    phone1: { 
      required,
      integer,
      minLength: minLength(10),
      maxLength: maxLength(10),
      minValue: minValue(0)
      },
    email: { required, email },
    firstName: { required },
    surname: { required }
  },
  data () {
    return {
      active: [],
      open: [],
      tree: [],
      firstName: '',
      otherName: '',
      surname: '',
      email: '',
      phone1: '',
      phone2: '',
      alertFail: false,
      alertSuccess: false,
      alertMsg: ''
    }
  },
  methods: {
    addHFS () {
      this.$store.state.dynamicProgress = true
      this.$store.state.progressTitle = 'Saving HFS'
      let formData = new FormData()
      formData.append('firstName', this.firstName)
      formData.append('otherName', this.otherName)
      formData.append('surname', this.surname)
      formData.append('email', this.email)
      formData.append('phone1', this.phone1)
      formData.append('phone2', this.phone2)
      formData.append('facility', this.active[0])
      for (let field in this.customFields) {
        formData.append(field, this.customFields[field])
      }
      axios.post(backendServer + '/addHFS/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }).then(() => {
        let fields = Object.keys(this.$v.$params)
        for (let field of fields) {
          this.$v[field].$reset()
        }
        this.$refs.form.reset()
        this.$store.state.dynamicProgress = false
        this.alertSuccess = true
        this.alertMsg = 'HFS added successfully'
      }).catch((err) => {
        this.$store.state.dynamicProgress = false
        this.alertFail = true
        this.alertMsg = 'This HFS was not added, something went wrong'
        console.log(err.response.data.error)
      })
    },
    getLocation (item) {
      let query
      if(!item.typeTag) {
        query = '?type=&checkChild=' + false + '&lastLocationType=facility'
      } else{
        query = '?type=' + item.typeTag + '&checkChild=' + false + '&id=' + item.id + '&lastLocationType=facility'
      }
      axios.get(backendServer + '/locationTree' + query).then ((data) => {
        item.children.push(...data.data)
        return item;
      })
    }
  },
  computed: {
    items () {
      return [
        {
          name: 'Parent*',
          children: this.tree
        }
      ]
    },
    phone1Errors () {
      const errors = []
      if (!this.$v.phone1.$dirty) return errors
      if(!this.$v.phone1.required) {
        errors.push('Phone 1 is required')
      }
      if(this.$v.phone1.$invalid) {
        errors.push('Phone 1 is in wrong format')
      }
      return errors
    },
    emailErrors () {
      const errors = []
      if (!this.$v.email.$dirty) return errors
      if(!this.$v.email.required) {
        errors.push('Email is required')
      }
      if(this.$v.email.$invalid) {
        errors.push('Email is in wrong format')
      }
      return errors
    },
    surnameErrors () {
      const errors = []
      if (!this.$v.surname.$dirty) return errors
      !this.$v.surname.required && errors.push('Surname is required')
      return errors
    },
    firstnameErrors () {
      const errors = []
      if (!this.$v.firstName.$dirty) return errors
      !this.$v.firstName.required && errors.push('Firstname is required')
      return errors
    }
  }
}
</script>
