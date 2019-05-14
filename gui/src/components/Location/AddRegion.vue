<template>
  <v-container>
    <v-layout
      row
      wrap>
      <v-spacer/>
      <v-flex xs6>
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
          style="max-width: 500px;">
          <v-system-bar
            color="deep-purple darken-4"
            dark/>
          <v-toolbar
            color="deep-purple accent-4"
            cards
            dark
            flat>
            <v-card-title class="title font-weight-regular">Add New Region</v-card-title>
          </v-toolbar>
          <v-form
            ref="form"
            class="pa-3 pt-4">
            <v-text-field
              required
              @blur="$v.name.$touch()"
              @change="$v.name.$touch()"
              :error-messages="nameErrors"
              v-model="name"
              box
              color="deep-purple"
              label="Region Name"/>
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
              @click="addRegion()"
              :disabled="$v.$invalid"
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
import { required, email } from 'vuelidate/lib/validators'

const backendServer = process.env.VUE_APP_BACKEND_SERVER

export default {
  validations: {
    name: { required }
  },
  data () {
    return {
      name: '',
      alertFail: false,
      alertSuccess: false,
      alertMsg: ''
    }
  },
  methods: {
    addRegion () {
      this.$store.state.dynamicProgress = true
      this.$store.state.progressTitle = 'Saving Region'
      let formData = new FormData()
      formData.append('name', this.name)
      axios.post(backendServer + '/addRegion/', formData, {
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
        this.alertMsg = 'Region added successfully'
      }).catch((err) => {
        this.$store.state.dynamicProgress = false
        this.alertFail = true
        this.alertMsg = 'This region was not added, ensure name is not used'
        console.log(err.response.data.error)
      })
    }
  },
  computed: {
    nameErrors () {
      const errors = []
      if (!this.$v.name.$dirty) return errors
      !this.$v.name.required && errors.push('Region Name is required')
      return errors
    }
  }
}
</script>
