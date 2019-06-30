<template>
  <v-container grid-list-xs>
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
          Are you sure you want to delete {{district.name}} ?
        </v-card-text>
        <v-card-actions>
          <v-btn
            color="primary"
            @click.native="deleteDialog = false"
          >Cancel</v-btn>
          <v-spacer></v-spacer>
          <v-btn
            color="error"
            @click.native="deleteDistrict"
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
            Editing {{district.name}}
          </v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn
            icon
            dark
            @click.native="closeDialog"
          >
            <v-icon>close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text>
          <v-layout column>
            <v-flex xs1>
              <v-text-field
                v-model="district.name"
                label="Name"
              ></v-text-field>
              <v-select
                required
                :items="regions"
                v-model="district.parent._id"
                item-text="name"
                item-value="_id"
                single-line
                box
                label="Region"
              ></v-select>
            </v-flex>
          </v-layout>
        </v-card-text>
        <v-card-actions style='float: center'>
          <v-btn
            color="error"
            @click.native="closeDialog"
            style="color: white"
          >
            <v-icon
              dark
              left
            >cancel</v-icon>Cancel
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn
            :disabled="!district.name"
            color="primary"
            dark
            @click.native="saveDistrict()"
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
            <v-flex xs6>
              List of districts
            </v-flex>
            <v-flex xs3>
              <v-text-field
                v-model="searchDistrict"
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
            :items="districts"
            class="elevation-1"
            pagination.sync="pagination"
            item-key="_id"
            :loading="loading"
            style="width:600px"
            :search="searchDistrict"
          >
            <tr
              :key="props.item._id"
              slot="items"
              slot-scope="props"
            >
              <td>
                <v-btn
                  v-if="$store.state.auth.role === 'Admin'"
                  color="success"
                  icon
                  @click="confirmDelete(props.item)"
                >
                  <v-icon>delete</v-icon>
                </v-btn>
                <v-btn
                  color="success"
                  icon
                  @click="editDistrict(props.item)"
                >
                  <v-icon>edit</v-icon>
                </v-btn>
              </td>
              <td>{{props.item.name}}</td>
              <td style="text-align: right">{{props.item.parent.name}}</td>
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
const backendServer = process.env.VUE_APP_BACKEND_SERVER
export default {
  data () {
    return {
      searchDistrict: '',
      deleteDialog: false,
      alertSuccess: false,
      alertFail: false,
      alertMsg: '',
      districts: [],
      regions: [],
      loading: false,
      editDialog: false,
      district: {},
      headers: [{ sortable: false, align: 'left' }, { text: "Name", value: "name" }, { text: "Region", value: "region", align: 'right' }]
    };
  },
  methods: {
    closeDialog () {
      this.district = {}
      this.editDialog = false
    },
    getDistricts () {
      this.loading = true
      axios.get(backendServer + '/getDistricts').then(response => {
        this.loading = false
        this.districts = response.data
      }).catch((err) => {
        this.$store.state.dialogError = true
        this.$store.state.errorTitle = "Error"
        this.$store.state.errorDescription = "An error occured while getting reports"
      })
    },
    getRegions () {
      axios.get(backendServer + '/location/Regions').then((response) => {
        this.regions = response.data
      })
    },
    editDistrict (district) {
      this.district = {}
      this.district = deepmerge.all([district])
      this.editDialog = true
    },
    saveDistrict () {
      let formData = new FormData()
      formData.append('id', this.district._id)
      formData.append('name', this.district.name)
      formData.append('parent', this.district.parent._id)
      formData.append('type', 'Districts')
      axios.post(backendServer + '/editLocation', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }).then((response) => {
        this.alertSuccess = true
        this.alertMsg = 'Changes saved successfully'
        this.editDialog = false
        this.getDistricts()
      }).catch((err) => {
        this.alertFail = true
        this.alertMsg = 'An error occured and changes were not saved'
        this.editDialog = false
      })
    },
    confirmDelete (district) {
      this.district = {}
      this.district = deepmerge.all([district])
      this.deleteDialog = true
    },
    deleteDistrict () {
      axios.delete(backendServer + `/deleteLocation/${this.district._id}/Districts`).then((response) => {
        this.alertSuccess = true
        this.alertMsg = 'Facility deleted successfully'
        this.deleteDialog = false
        this.getDistricts()
      }).catch((err) => {
        this.alertFail = true
        this.alertMsg = 'An error occured while deleting village'
        this.deleteDialog = false
      })
    }
  },
  created () {
    this.getDistricts()
    this.getRegions()
  }
};
</script>
