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
              label="Month"
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
    <v-layout row wrap>
      <v-flex xs5>
        <v-btn v-if='csvData.length > 0' color="primary" @click="downloadCSV">
          <v-icon left>file_copy</v-icon>Download CSV
        </v-btn>
      </v-flex>
      <v-spacer></v-spacer>
      <v-flex xs5>
        <v-text-field
          v-model="search"
          label="Search"
        ></v-text-field>
      </v-flex>
    </v-layout>
    <v-data-table
      :headers="reportHeader"
      :items="reportRows"
      :search="search"
      hide-actions
      pagination.sync="pagination"
      item-key="id"
    >
      <template v-slot:items="props">
        <td class="text-xs-center">{{ props.item.month | monthFormatted }}</td>
        <td class="text-xs-center">{{ props.item.name }}</td>
        <td class="text-xs-center">{{ props.item.age }}</td>
        <td class="text-xs-center">{{ props.item.gender }}</td>
        <td class="text-xs-center">{{ props.item.symptoms.join(', ') }}</td>
        <td class="text-xs-center">{{ props.item.village }}</td>
        <td class="text-xs-center">{{ props.item.ward }}</td>
        <td class="text-xs-center">{{ props.item.district }}</td>
        <td class="text-xs-center">{{ props.item.region }}</td>
      </template>
    </v-data-table>
  </v-container>
</template>
<script>
import axios from 'axios'
import moment from 'moment'
const backendServer = process.env.VUE_APP_BACKEND_SERVER
export default {
  filters: {
    monthFormatted (value) {
      if (!value) {
        return null
      }
      return moment(value).format('MMMM YYYY')
    }
  },
  data () {
    return {
      search: '',
      reportRows: [],
      reportHeader: [
        { text: 'Month', value: 'Month' },
        { text: 'Full Name', value: 'name' },
        { text: 'Age', value: 'age' },
        { text: 'Gender', value: 'gender' },
        { text: 'Symptoms', value: 'symptoms' },
        { text: 'Village', value: 'village' },
        { text: 'Ward', value: 'ward' },
        { text: 'District', value: 'district' },
        { text: 'Region', value: 'region' }
      ],
      month: new Date().toISOString().substr(0, 7),
      monthMenu: false,
      csvData: ''
    }
  },
  methods: {
    generate () {
      axios
        .get(backendServer + '/getCOVIDCases?month=' + this.month)
        .then(report => {
          this.reportRows = report.data.report
          this.csvData = report.data.csv
        })
    },
    downloadCSV () {
      const encoding = 'data:text/csv;charset=utf-8,'
      const csvData = encoding + escape(this.csvData)
      const link = document.createElement('a')
      link.setAttribute('href', csvData)
      link.setAttribute(
        'download',
        'submissionReport.csv'
      )
      link.click()
    }
  },
  computed: {
    monthFormatted () {
      if (!this.month) {
        return null
      }
      return moment(this.month).format('MMMM YYYY')
    }
  },
  created () {
    this.generate()
  }
}
</script>
