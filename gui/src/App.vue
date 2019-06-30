<template>
  <v-app>
    <v-toolbar
      color="indigo"
      dark
      app
    >
      <v-toolbar-title v-text="title"></v-toolbar-title>
      <v-spacer></v-spacer>
      <v-toolbar-items v-if="$store.state.auth.token">
        <v-btn
          flat
          to="Dashboard"
          v-if="!$store.state.denyAccess"
        >
          <v-icon>dashboard</v-icon> Home
        </v-btn>
        <v-btn
          flat
          to="AddCHA"
          v-if="!$store.state.denyAccess"
        >
          <v-icon>add</v-icon> Add CHA
        </v-btn>
        <v-btn
          flat
          to="AddHFS"
          v-if="!$store.state.denyAccess"
        >
          <v-icon>add</v-icon> Add HFS
        </v-btn>
        <v-menu
          open-on-hover
          bottom
          offset-y
          v-if="!$store.state.denyAccess"
        >
          <v-btn
            slot="activator"
            flat
          >
            <v-icon>perm_identity</v-icon>Geographical Locations
          </v-btn>
          <v-list>
            <v-list-tile
              to="addRegion"
              v-if="$store.state.auth.role === 'Admin'"
            >
              <v-list-tile-title>
                <v-icon>add</v-icon>Add Region
              </v-list-tile-title>
            </v-list-tile>
            <v-list-tile
              to="addDistrict"
              v-if="$store.state.auth.role === 'Admin'"
            >
              <v-list-tile-title>
                <v-icon>add</v-icon>Add District
              </v-list-tile-title>
            </v-list-tile>
            <v-list-tile
              to="addFacility"
              v-if="$store.state.auth.role === 'Admin'"
            >
              <v-list-tile-title>
                <v-icon>add</v-icon>Add Facility
              </v-list-tile-title>
            </v-list-tile>
            <v-list-tile
              to="addVillage"
              v-if="$store.state.auth.role === 'Admin'"
            >
              <v-list-tile-title>
                <v-icon>add</v-icon>Add Village
              </v-list-tile-title>
            </v-list-tile>
          </v-list>
        </v-menu>
        <v-menu
          open-on-hover
          bottom
          offset-y
          v-if="!$store.state.denyAccess"
        >
          <v-btn
            slot="activator"
            flat
          >
            <v-icon>list</v-icon>Reports
          </v-btn>
          <v-list>
            <v-list-tile
              to="RegionsReport"
              v-if="$store.state.auth.role === 'Admin'"
            >
              <v-list-tile-title>
                <v-icon>list</v-icon>Regions
              </v-list-tile-title>
            </v-list-tile>
            <v-list-tile
              to="DistrictsReport"
              v-if="$store.state.auth.role === 'Admin'"
            >
              <v-list-tile-title>
                <v-icon>list</v-icon>Districts
              </v-list-tile-title>
            </v-list-tile>
            <v-list-tile
              to="FacilitiesReport"
              v-if="$store.state.auth.role === 'Admin'"
            >
              <v-list-tile-title>
                <v-icon>list</v-icon>Facilities
              </v-list-tile-title>
            </v-list-tile>
            <v-list-tile
              to="VillagesReport"
              v-if="$store.state.auth.role === 'Admin'"
            >
              <v-list-tile-title>
                <v-icon>list</v-icon>Villages
              </v-list-tile-title>
            </v-list-tile>
            <v-list-tile
              to="CHAReport"
              v-if="$store.state.auth.role === 'Admin'"
            >
              <v-list-tile-title>
                <v-icon>list</v-icon>CHA
              </v-list-tile-title>
            </v-list-tile>
            <v-list-tile
              to="HFSReport"
              v-if="$store.state.auth.role === 'Admin'"
            >
              <v-list-tile-title>
                <v-icon>list</v-icon>HFS
              </v-list-tile-title>
            </v-list-tile>
          </v-list>
        </v-menu>
        <v-menu
          open-on-hover
          bottom
          offset-y
          v-if="!$store.state.denyAccess"
        >
          <v-btn
            slot="activator"
            flat
          >
            <v-icon>perm_identity</v-icon>Account
          </v-btn>
          <v-list>
            <v-tooltip top>
              <v-list-tile
                to="addUser"
                slot="activator"
                v-if="$store.state.auth.role === 'Admin'"
              >
                <v-list-tile-title>
                  <v-icon>perm_identity</v-icon>Add User
                </v-list-tile-title>
              </v-list-tile>
              <span>Add a new user</span>
            </v-tooltip>
            <v-tooltip bottom>
              <v-list-tile
                to="usersList"
                slot="activator"
                v-if="$store.state.auth.role === 'Admin'"
              >
                <v-list-tile-title>
                  <v-icon>perm_identity</v-icon>Users List
                </v-list-tile-title>
              </v-list-tile>
              <span>A list of users that can access the system</span>
            </v-tooltip>
            <v-list-tile to="changePassword">
              <v-list-tile-title>
                <v-icon>perm_identity</v-icon>Change Password
              </v-list-tile-title>
            </v-list-tile>
          </v-list>
        </v-menu>
        <v-btn
          flat
          to="Logout"
          v-if="!$store.state.denyAccess"
        >
          <v-icon>logout</v-icon> Logout
        </v-btn>
      </v-toolbar-items>
      <v-spacer></v-spacer>
      <v-toolbar-items> </v-toolbar-items>
    </v-toolbar>
    <v-content>
      <v-dialog
        v-model="$store.state.dynamicProgress"
        persistent
        width="300"
      >
        <v-card
          color="primary"
          dark
        >
          <v-card-text>
            {{ $store.state.progressTitle }}
            <v-progress-linear
              indeterminate
              color="white"
              class="mb-0"
            ></v-progress-linear>
          </v-card-text>
        </v-card>
      </v-dialog>
      <v-dialog
        persistent
        v-model="$store.state.dialogError"
        max-width="500px"
      >
        <v-card>
          <v-toolbar
            color="primary"
            dark
          >
            <v-toolbar-title>
              {{ $store.state.errorTitle }}
            </v-toolbar-title>
          </v-toolbar>
          <v-card-text>
            {{ $store.state.errorDescription }}
          </v-card-text>
          <v-card-actions>
            <v-btn
              color="primary"
              @click.native="$store.state.dialogError = false"
            >Ok</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
      <router-view />
    </v-content>
    <v-footer
      dark
      color="indigo"
      :fixed="fixed"
      app
    > </v-footer>
  </v-app>
</template>

<script>
const backendServer = process.env.VUE_APP_BACKEND_SERVER;
import axios from "axios";
import VueCookies from "vue-cookies";
export default {
  name: "App",
  components: {},
  data () {
    return {
      title: "CHAD",
      fixed: false
    };
  },
  created () {
    if (VueCookies.get("token") && VueCookies.get("userID")) {
      this.$store.state.auth.token = VueCookies.get("token");
      this.$store.state.auth.userID = VueCookies.get("userID");
      this.$store.state.auth.username = VueCookies.get("username");
      this.$store.state.auth.role = VueCookies.get("role");
      axios.get(backendServer + "/isTokenActive/").then(response => {
        // will come here only if the token is active
        this.$store.state.denyAccess = false;
      });
    }
  }
};
</script>
