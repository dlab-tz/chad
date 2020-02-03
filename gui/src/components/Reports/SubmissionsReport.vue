<template>
  <v-container grid-list-xs>
    <v-layout
      row
      wrap
    >
      <v-spacer></v-spacer>
      <v-flex xs2>
        <v-menu
          ref="menu"
          v-model="monthMenu"
          :close-on-content-click="false"
          :return-value.sync="month"
          transition="scale-transition"
          offset-y
          max-width="290px"
          min-width="290px"
        >
          <template v-slot:activator="{ on }">
            <v-text-field
              v-model="monthFormatted"
              label="Picker in menu"
              prepend-icon="event"
              readonly
              v-on="on"
            ></v-text-field>
          </template>
          <v-date-picker
            v-model="month"
            type="month"
            color="green lighten-1"
            header-color="primary"
          >
            <v-btn
              text
              color="primary"
              @click="menu = false"
            >Cancel</v-btn>
            <v-spacer></v-spacer>
            <v-btn
              text
              color="primary"
              @click="$refs.menu.save(month)"
            >OK</v-btn>
          </v-date-picker>
        </v-menu>
      </v-flex>
      <v-spacer></v-spacer>
      <v-flex xs2>
        <v-btn
          color="primary"
          round
          @click="generate"
        >
          <v-icon left>list</v-icon> Filter
        </v-btn>
      </v-flex>
      <v-spacer></v-spacer>
    </v-layout>
    <v-data-table
      :headers="reportHeader"
      :items="reportRows"
      hide-actions
      pagination.sync="pagination"
      item-key="id"
    >
      <template v-slot:items="props">
        <td>{{monthFormatted}}</td>
        <td class="text-xs-center">{{ props.item.village }}</td>
        <td class="text-xs-center">{{ props.item.chw }}</td>
        <td class="text-xs-center">{{ props.item.househoulds }}</td>
      </template>
    </v-data-table>
  </v-container>
</template>
<script>
import axios from "axios";
const backendServer = process.env.VUE_APP_BACKEND_SERVER;
export default {
  data() {
    return {
      reportRows: [],
      reportHeader: [
        { text: "Month", value: "Month" },
        { text: "Village", value: "village" },
        { text: "CHW Name", value: "chw" },
        { text: "Number of Households", value: "househoulds" }
      ],
      month: new Date().toISOString().substr(0, 7),
      monthMenu: false,
      startDateMenu: false,
      endDateMenu: false,
      startDate: new Date("2019-05-01").toISOString().substr(0, 10),
      endDate: new Date().toISOString().substr(0, 10),
      chartOptions: []
    };
  },
  methods: {
    generate() {
      axios
        .get(backendServer + "/getSubmissionsReport?month=" + this.month)
        .then(report => {
          this.reportRows = report.data;
        });
    }
  },
  computed: {
    monthFormatted() {
      if (!this.month) {
        return null;
      }
      const [year, month] = this.month.split("-");
      return `${month}/${year}`;
    }
  },
  created() {
    this.generate();
  }
};
</script>
