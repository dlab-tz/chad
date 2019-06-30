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
          Are you sure you want to delete {{village.name}} ?
        </v-card-text>
        <v-card-actions>
          <v-btn
            color="primary"
            @click.native="deleteDialog = false"
          >Cancel</v-btn>
          <v-spacer></v-spacer>
          <v-btn
            color="error"
            @click.native="deleteVillage"
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
            Editing {{village.name}}
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
                v-model="village.name"
                label="Name"
              ></v-text-field>
              Facility {{village.parent.name}}
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
            :disabled="!village.name"
            color="primary"
            dark
            @click.native="saveVillage()"
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
          List of villages
          <v-data-table
            :headers="headers"
            :items="villages"
            class="elevation-1"
            pagination.sync="pagination"
            item-key="_id"
            :loading="loading"
            style="width:600px"
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
                  v-if="$store.state.auth.role == 'Admin'"
                  color="success"
                  icon
                  @click="editVillage(props.item)"
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
import { generalMixin } from '@/generalMixin'
const backendServer = process.env.VUE_APP_BACKEND_SERVER
export default {
  mixins: [generalMixin],
  data () {
    return {
      deleteDialog: false,
      alertSuccess: false,
      alertFail: false,
      alertMsg: '',
      villages: [],
      tree: [],
      active: [],
      open: [],
      loading: false,
      editDialog: false,
      village: {},
      headers: [{ sortable: false, align: 'left' }, { text: "Name", value: "name" }, { text: "Facility", value: "facility", align: 'right' }]
    };
  },
  methods: {
    closeDialog () {
      this.village = {}
      this.editDialog = false
    },
    getVillages () {
      this.loading = true
      axios.get(backendServer + '/getVillages').then(response => {
        this.loading = false
        this.villages = response.data
      }).catch((err) => {
        this.$store.state.dialogError = true
        this.$store.state.errorTitle = "Error"
        this.$store.state.errorDescription = "An error occured while getting reports"
      })
    },
    editVillage (village) {
      this.village = {}
      this.village = deepmerge.all([village])
      this.editDialog = true
    },
    saveVillage () {
      let formData = new FormData()
      formData.append('id', this.village._id)
      formData.append('name', this.village.name)
      formData.append('parent', this.village.parent._id)
      formData.append('type', 'Villages')
      axios.post(backendServer + '/editLocation', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }).then((response) => {
        this.alertSuccess = true
        this.alertMsg = 'Changes saved successfully'
        this.editDialog = false
        this.getVillages()
      }).catch((err) => {
        this.alertFail = true
        this.alertMsg = 'An error occured and changes were not saved'
        this.editDialog = false
      })
    },
    confirmDelete (village) {
      this.village = {}
      this.village = deepmerge.all([village])
      this.deleteDialog = true
    },
    deleteVillage () {
      axios.delete(backendServer + `/deleteLocation/${this.village._id}/Villages`).then((response) => {
        this.alertSuccess = true
        this.alertMsg = 'Village deleted successfully'
        this.deleteDialog = false
        this.getVillages()
      }).catch((err) => {
        this.alertFail = true
        this.alertMsg = 'An error occured while deleting village'
        this.deleteDialog = false
      })
    }
  },
  computed: {
    locations () {
      return [
        {
          name: 'Parent',
          children: this.tree
        }
      ]
    }
  },
  watch: {
    active (newValue, oldValue) {
      if (newValue.length === 0) {
        return
      }
      this.village.parent.name = newValue[0].name
      this.village.parent.parent = newValue[0].parent
      this.village.parent._id = newValue[0].id
    }
  },
  created () {
    this.getVillages()
    this.lastLocationType = 'facility'
  }
};
</script>
