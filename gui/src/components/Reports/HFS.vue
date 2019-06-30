<template>
  <v-container grid-list-xl>
    <v-dialog
      v-if="deleteDialog"
      persistent
      v-model="deleteDialog"
      max-width="500px"
    >
      <v-card>
        <v-toolbar
          color="error"
          dark
        >
          <v-toolbar-title>
            Confirm deleting
          </v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn
            icon
            dark
            @click.native="deleteDialog = false"
          >
            <v-icon>close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text>
          Are you sure you want to delete {{hfs.firstName}} {{hfs.surname}} ?
        </v-card-text>
        <v-card-actions>
          <v-btn
            color="primary"
            @click.native="deleteDialog = false"
          >Cancel</v-btn>
          <v-spacer></v-spacer>
          <v-btn
            color="error"
            @click.native="deleteCHA"
          >Ok</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog
      v-if="editDialog"
      persistent
      v-model="editDialog"
      width="530px"
    >
      <v-card width='530px'>
        <v-toolbar
          color="primary"
          dark
        >
          <v-toolbar-title>
            Editing {{hfs.firstName}} {{hfs.surname}}
          </v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn
            icon
            dark
            @click.native="editDialog = false"
          >
            <v-icon>close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text>
          <v-layout column>
            <v-flex xs1>
              <v-text-field
                required
                @blur="$v.firstName.$touch()"
                @change="$v.firstName.$touch()"
                :error-messages="firstnameErrors"
                v-model="firstName"
                box
                color="deep-purple"
                label="First Name*"
              />
              <v-text-field
                v-model="otherName"
                box
                color="deep-purple"
                label="Middle Names"
              />
              <v-text-field
                required
                @blur="$v.surname.$touch()"
                @change="$v.surname.$touch()"
                :error-messages="surnameErrors"
                v-model="surname"
                box
                color="deep-purple"
                label="Surname*"
              />
              <v-text-field
                required
                @blur="$v.phone1.$touch()"
                @change="$v.phone1.$touch()"
                :error-messages="phone1Errors"
                v-model="phone1"
                box
                color="deep-purple"
                label="Mobile Phone 1*"
              />
              <v-text-field
                v-model="phone2"
                box
                color="deep-purple"
                label="Mobile Phone 2"
              />
              <v-text-field
                required
                @blur="$v.email.$touch()"
                @change="$v.email.$touch()"
                :error-messages="emailErrors"
                v-model="email"
                box
                color="deep-purple"
                label="Email*"
              />
              Facility {{hfs.facility.name}}
              <v-treeview
                :active.sync="active"
                :open.sync="open"
                :items="locations"
                :load-children="getLocation"
                activatable
                return-object
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
        </v-card-text>
        <v-card-actions style='float: center'>
          <v-btn
            color="error"
            @click.native="editDialog = false"
            style="color: white"
          >
            <v-icon
              dark
              left
            >cancel</v-icon>Cancel
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn
            :disabled="$v.$invalid || !hfs.facility.name"
            color="primary"
            dark
            @click.native="saveEdit()"
          >
            <v-icon left>save</v-icon>Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-layout column>
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
      <center>
        <v-flex>
          <v-layout
            row
            wrap
          >
            <v-flex xs7>
              List of HFSs
            </v-flex>
            <v-flex xs5>
              <v-text-field
                v-model="searchHFS"
                append-icon="search"
                label="Search"
                single-line
                hide-details
                color="primary"
              />
            </v-flex>
          </v-layout>
          <v-data-table
            :headers="headers"
            :items="hfss"
            class="elevation-1"
            pagination.sync="pagination"
            item-key="_id"
            :loading="loading"
            :search="searchHFS"
          >
            <tr
              :key="props.item._id"
              slot="items"
              slot-scope="props"
            >
              <td>
                <v-btn
                  v-if="$store.state.auth.role == 'Admin'"
                  color="success"
                  icon
                  @click="editHFS(props.item)"
                >
                  <v-icon>edit</v-icon>
                </v-btn>
              </td>
              <td>{{props.item.firstName}}</td>
              <td>{{props.item.surname}}</td>
              <td>{{props.item.otherName}}</td>
              <td>{{props.item.phone1}}</td>
              <td>{{props.item.phone2}}</td>
              <td>{{props.item.email}}</td>
              <td>{{props.item.facility.name}}</td>
            </tr>
          </v-data-table>
        </v-flex>
      </center>
    </v-layout>
  </v-container>
</template>
<script>
import axios from 'axios'
import deepmerge from 'deepmerge'
import { generalMixin } from '@/generalMixin'
import { required, email, integer, minLength, maxLength, minValue } from 'vuelidate/lib/validators'
const backendServer = process.env.VUE_APP_BACKEND_SERVER
export default {
  mixins: [generalMixin],
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
      searchHFS: '',
      active: [],
      open: [],
      tree: [],
      firstName: '',
      otherName: '',
      surname: '',
      email: '',
      phone1: '',
      phone2: '',
      loading: false,
      deleteDialog: false,
      editDialog: false,
      alertMsg: '',
      alertFail: false,
      alertSuccess: false,
      hfss: [],
      hfs: {},
      headers: [
        { sortable: false, align: 'left' },
        { text: "First Name", value: "firstName" },
        { text: "Surname", value: "surname" },
        { text: "Other Name", value: "otherName" },
        { text: "Mobile Phone 1", value: "phone1" },
        { text: "Mobile Phone 2", value: "phone2" },
        { text: "Email", value: "email" },
        { text: "Facility", value: "facility" }
      ]
    }
  },
  methods: {
    getHFS () {
      this.loading = true
      axios.get(backendServer + '/getHFSById').then((response) => {
        this.loading = false
        this.hfss = response.data
      }).catch((err) => {
        this.$store.state.dialogError = true
        this.$store.state.errorTitle = "Error"
        this.$store.state.errorDescription = "An error occured while getting HFS"
      })
    },
    editHFS (hfs) {
      this.hfs = {}
      this.hfs = deepmerge.all([hfs])
      this.editDialog = true
      for (let hfs in this.hfs) {
        if (this.hfs[hfs] !== 'null' && this.hfs[hfs] !== 'undefined') {
          this.$data[hfs] = this.hfs[hfs]
        }
      }
    },
    saveEdit () {
      for (let hfs in this.hfs) {
        this.hfs[hfs] = this.$data[hfs]
      }
      let formData = new FormData()
      if (this.active.length > 0) {
        this.hfs.facility._id = this.active[0].id
      }
      formData.append('hfs', JSON.stringify(this.hfs))
      axios.post(backendServer + '/editHFS', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }).then((response) => {
        this.alertSuccess = true
        this.alertMsg = 'Changes saved successfully'
        this.editDialog = false
        this.getHFS()
      }).catch((err) => {
        this.alertFail = true
        this.alertMsg = 'An error occured and changes were not saved'
        this.editDialog = false
      })
    }
  },
  computed: {
    locations () {
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
      if (!this.$v.phone1.required) {
        errors.push('Phone 1 is required')
      }
      if (this.$v.phone1.$invalid) {
        errors.push('Phone 1 is in wrong format')
      }
      return errors
    },
    emailErrors () {
      const errors = []
      if (!this.$v.email.$dirty) return errors
      if (!this.$v.email.required) {
        errors.push('Email is required')
      }
      if (this.$v.email.$invalid) {
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
  },
  created () {
    this.getHFS()
    this.lastLocationType = 'facility'
  }
}
</script>
