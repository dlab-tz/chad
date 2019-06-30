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
          Are you sure you want to delete {{region.name}} ?
        </v-card-text>
        <v-card-actions>
          <v-btn
            color="primary"
            @click.native="deleteDialog = false"
          >Cancel</v-btn>
          <v-spacer></v-spacer>
          <v-btn
            color="error"
            @click.native="deleteRegion"
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
            Editing {{region.name}}
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
                v-model="region.name"
                label="Name"
              ></v-text-field>
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
            :disabled="!region.name"
            color="primary"
            dark
            @click.native="saveRegion()"
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
              List of region
            </v-flex>
            <v-flex xs3>
              <v-text-field
                v-model="searchRegion"
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
            :items="regions"
            class="elevation-1"
            pagination.sync="pagination"
            item-key="_id"
            :loading="loading"
            style="width:550px"
            :search="searchRegion"
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
                  @click="editRegion(props.item)"
                >
                  <v-icon>edit</v-icon>
                </v-btn>
              </td>
              <td>{{props.item.name}}</td>
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
      searchRegion: '',
      deleteDialog: false,
      alertSuccess: false,
      alertFail: false,
      alertMsg: '',
      regions: [],
      loading: false,
      editDialog: false,
      region: {},
      headers: [{ sortable: false, align: 'left', width: 2 }, { text: "Name", value: "name", width: 20 }]
    };
  },
  methods: {
    closeDialog () {
      this.region = {}
      this.editDialog = false
    },
    getRegions () {
      this.loading = true
      axios.get(backendServer + '/getRegions').then(response => {
        this.loading = false
        this.regions = response.data
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
    editRegion (region) {
      this.region = {}
      this.region = deepmerge.all([region])
      this.editDialog = true
    },
    saveRegion () {
      let formData = new FormData()
      formData.append('id', this.region._id)
      formData.append('name', this.region.name)
      formData.append('type', 'Regions')
      axios.post(backendServer + '/editLocation', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }).then((response) => {
        this.alertSuccess = true
        this.alertMsg = 'Changes saved successfully'
        this.editDialog = false
        this.getRegions()
      }).catch((err) => {
        this.alertFail = true
        this.alertMsg = 'An error occured and changes were not saved'
        this.editDialog = false
      })
    },
    confirmDelete (region) {
      this.region = {}
      this.region = deepmerge.all([region])
      this.deleteDialog = true
    },
    deleteRegion () {
      axios.delete(backendServer + `/deleteLocation/${this.region._id}/Regions`).then((response) => {
        this.alertSuccess = true
        this.alertMsg = 'Facility deleted successfully'
        this.deleteDialog = false
        this.getRegions()
      }).catch((err) => {
        this.alertFail = true
        this.alertMsg = 'An error occured while deleting village'
        this.deleteDialog = false
      })
    }
  },
  created () {
    this.getRegions()
  }
};
</script>
