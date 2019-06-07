<template>
  <v-container grid-list-xs>
    <v-layout row wrap>
      <v-spacer></v-spacer>
      <v-flex xs2>
        <v-menu
          v-model="startDateMenu"
          :close-on-content-click="false"
          :nudge-right="40"
          lazy
          transition="scale-transition"
          offset-y
          full-width
          min-width="290px"
        >
          <template v-slot:activator="{ on }">
            <v-text-field
              v-model="startDateFormatted"
              label="Start Date"
              prepend-icon="event"
              readonly
              v-on="on"
            ></v-text-field>
          </template>
          <v-date-picker v-model="startDate" @input="startDateMenu = false"></v-date-picker>
        </v-menu>
      </v-flex>
      <v-spacer></v-spacer>
      <v-flex xs2>
        <v-menu
          v-model="endDateMenu"
          :close-on-content-click="false"
          :nudge-right="40"
          lazy
          transition="scale-transition"
          offset-y
          full-width
          min-width="290px"
        >
          <template v-slot:activator="{ on }">
            <v-text-field
              v-model="endDateFormatted"
              label="End Date"
              prepend-icon="event"
              readonly
              v-on="on"
            ></v-text-field>
          </template>
          <v-date-picker v-model="endDate" @input="endDateMenu = false"></v-date-picker>
        </v-menu>
      </v-flex>
      <v-spacer></v-spacer>
      <v-flex xs2>
        <v-btn color="primary" round @click="generate"><v-icon left>list</v-icon> Filter</v-btn>
      </v-flex>
      <v-spacer></v-spacer>
    </v-layout>
    <v-layout row wrap>
      <v-flex xs6 v-for='(chartOption, index) in chartOptions' :key='index'>
        {{chartOption.title.text}}
        <v-chart :options="chartOption"/>
      </v-flex>
    </v-layout>
  </v-container>
</template>
<script>
import axios from 'axios'
import ECharts from 'vue-echarts'
import 'echarts/lib/chart/pie'
import 'echarts/lib/component/tooltip'
import 'echarts/lib/component/legend'
import { setTimeout } from 'timers';
const aggreatorServer = process.env.VUE_APP_AGGREGATOR_SERVER
const aggreatorToken = process.env.VUE_APP_AGGREGATOR_TOKEN
const householdFormId = process.env.VUE_APP_HOUSEHOLD_FORMID
export default {
  components: {
    'v-chart': ECharts
  },
  data() {
    return {
      startDateMenu: false,
      endDateMenu: false,
      startDate: new Date().toISOString().substr(0, 10),
      endDate: new Date().toISOString().substr(0, 10),
      chartOptions: []
    }
  },
  methods: {
    formatDate (date) {
      if (!date) {
        return null
      }
      const [year, month, day] = date.split('-')
      return `${day}/${month}/${year}`
    },
    createChartDefOpt () {
      let opt = {
        title : {
          text: '',
          subtext: '',
          x:'center'
        },
        tooltip : {
          trigger: 'item',
          formatter: "{a} <br/>{b} : {c} ({d}%)"
        },
        legend: {
          orient: 'vertical',
          left: 'left',
          data: []
        },
        series : [{
          name: '',
          type: 'pie',
          radius : '30%',
          center: ['35%', '40%'],
          roseType: 'radius',
          data:[],
          animation: true,
          animationType: 'expansion',
          animationThreshold: 2000,
          animationDuration: 1000,
          animationDelay: 0
        }]
      }
      return opt
    },
    generate() {
      this.chartOptions = []
      let indicators = {
        pregnant_woman: {
          value: 0, key: 'pregnant_woman_all'
        },
        breast_feeding: {
          value: 0, key: 'breast_feeding_all'
        },
        neonates: {
          value: 0, key: 'neonates_all'
        },
        infants: {
          value: 0, key: 'infants_all'
        },
        children_under5: {
          value: 0, key: 'children_all'
        },
        adolescents_girls: {
          value: 0, key: 'adolescents_girl_10_19_all'
        },
        adolescents_boys: {
          value: 0, key: 'adolescents_boy_10_19_all'
        },
        female_youth_20_24: {
          value: 0, key: 'female_youth_all'
        },
        male_youth_20_24: {
          value: 0, key: 'male_youth_all'
        },
        female_15_49: {
          value: 0, key: 'Female_15_49_all'
        },
        male_15_49: {
          value: 0, key: 'Male_15_49_all'
        },
        female_above_50: {
          value: 0, key: 'female_above_50_all'
        },
        male_above_50: {
          value: 0, key: 'male_above_50_all'
        },
        female_total: {
          value: 0, key: 'female_number_household'
        },
        male_total: {
          value: 0, key: 'male_number_household'
        }
      }
      let startDate = this.startDate.split('-')
      let endDate = this.endDate.split('-')
      let startYear = startDate[0]
      let endYear = endDate[0]
      let startMonth = startDate[1]
      let endMonth = endDate[1]
      let startDay = startDate[2]
      let endDay = endDate[2]
      let query = `
        date_created__year__gte=${startYear}&date_created__year__lte=${endYear}&`+
        `date_created__month__gte=${startMonth}&date_created__month__lte=${endMonth}&`+
        `date_created__day__gte=${startDay}&date_created__day__lte=${endDay}
      `
      console.log(query);
      axios.get(aggreatorServer + `/api/v1/data/${householdFormId}?${query}`).then((households) => {
        let total_households = 0, houses = []
        for(let household of households.data) {
          let house_name = this.getDataFromJSON(household, 'house_name')
          if(house_name == 'add_new') {
            house_name = this.getDataFromJSON(household, 'house_name_new')
            let house_number = this.getDataFromJSON(household, 'house_number_new')
            house_name = house_name + " - " + house_number
            let exists = houses.find((house) => {
              return house === house_name
            })
            if(!exists) {
              total_households++
              houses.push(house_name)
            }
          }

          for(let indicator in indicators) {
            let value = this.getDataFromJSON(household, indicators[indicator].key)
            if(value) {
              indicators[indicator].value += value
            }
          }
        }
        
        //total household members
        pieOption = this.createChartDefOpt()
        pieOption.title.text = 'Total Male vs Female'
        pieOption.title.subtext = 'Total Male vs Female'
        pieOption.series[0].name = 'Total Male vs Female'
        pieOption.legend.data.push(`Female (${indicators['female_total'].value})`)
        pieOption.legend.data.push(`Male (${indicators['male_total'].value})`)
        pieOption.series[0].data.push({
          name: `Female (${indicators['female_total'].value})`,
          value: indicators['female_total'].value
        })
        pieOption.series[0].data.push({
          name: `Male (${indicators['male_total'].value})`,
          value: indicators['male_total'].value
        })
        this.chartOptions.push(pieOption)

        //resident population vs total households
        pieOption = this.createChartDefOpt()
        pieOption.title.text = 'Total Households vs Resident Population'
        pieOption.title.subtext = 'Total Households vs Resident Population'
        pieOption.series[0].name = 'Total Households vs Resident Population'
        let total_pop = indicators['female_total'].value + indicators['male_total'].value
        pieOption.legend.data.push(`Population (${total_pop})`)
        pieOption.legend.data.push(`Households (${total_households})`)
        pieOption.series[0].data.push({
          name: `Population (${total_pop})`,
          value: total_pop
        })
        pieOption.series[0].data.push({
          name: `Households (${total_households})`,
          value: total_households
        })
        this.chartOptions.push(pieOption)

        //pregnant women vs breast feeding women
        let pieOption = this.createChartDefOpt()
        pieOption.title.text = 'Pregnant women vs Breast feeding women'
        pieOption.title.subtext = 'Pregnant women vs Breast feeding women'
        pieOption.series[0].name = 'Pregnant women vs Breast feeding women'
        pieOption.legend.data.push(`Breast Feeding (${indicators['breast_feeding'].value})`)
        pieOption.legend.data.push(`Pregnant Women (${indicators['pregnant_woman'].value})`)
        pieOption.series[0].data.push({
          name: `Breast Feeding (${indicators['breast_feeding'].value})`,
          value: indicators['breast_feeding'].value
        })
        pieOption.series[0].data.push({
          name: `Pregnant Women (${indicators['pregnant_woman'].value})`,
          value: indicators['pregnant_woman'].value
        })
        this.chartOptions.push(pieOption)

        //Adolescent boys vs Adolescent girls
        pieOption = this.createChartDefOpt()
        pieOption.title.text = 'Adolescent girls vs Adolescent boys'
        pieOption.title.subtext = 'Adolescent girls vs Adolescent boys'
        pieOption.series[0].name = 'Adolescent girls vs Adolescent boys'
        pieOption.legend.data.push(`Girls (${indicators['adolescents_girls'].value})`)
        pieOption.legend.data.push(`Boys (${indicators['adolescents_boys'].value})`)
        pieOption.series[0].data.push({
          name: `Girls (${indicators['adolescents_girls'].value})`,
          value: indicators['adolescents_girls'].value
        })
        pieOption.series[0].data.push({
          name: `Boys (${indicators['adolescents_boys'].value})`,
          value: indicators['adolescents_boys'].value
        })
        this.chartOptions.push(pieOption)

        //male 15-49 vs female 15-49
        pieOption = this.createChartDefOpt()
        pieOption.title.text = 'Male vs Female (15-49 Years)'
        pieOption.title.subtext = 'Male vs Female (15-49 Years)'
        pieOption.series[0].name = 'Male vs Female (15-49 Years)'
        pieOption.legend.data.push(`Female (${indicators['female_15_49'].value})`)
        pieOption.legend.data.push(`Male (${indicators['male_15_49'].value})`)
        pieOption.series[0].data.push({
          name: `Female (${indicators['female_15_49'].value})`,
          value: indicators['female_15_49'].value
        })
        pieOption.series[0].data.push({
          name: `Male (${indicators['male_15_49'].value})`,
          value: indicators['male_15_49'].value
        })
        this.chartOptions.push(pieOption)

        //male vs female 50 and above
        pieOption = this.createChartDefOpt()
        pieOption.title.text = 'Male vs Female (50 Years and above)'
        pieOption.title.subtext = 'Male vs Female (50 Years and above)'
        pieOption.series[0].name = 'Male vs Female (50 Years and above)'
        pieOption.legend.data.push(`Female (${indicators['female_above_50'].value})`)
        pieOption.legend.data.push(`Male (${indicators['male_above_50'].value})`)
        pieOption.series[0].data.push({
          name: `Female (${indicators['female_above_50'].value})`,
          value: indicators['female_above_50'].value
        })
        pieOption.series[0].data.push({
          name: `Male (${indicators['male_above_50'].value})`,
          value: indicators['male_above_50'].value
        })
        this.chartOptions.push(pieOption)

        //Neonates vs Infants
        pieOption = this.createChartDefOpt()
        pieOption.title.text = 'Neonates (under 28 days) vs Infants (1 month to under 1 year) vs Children (1 to under 5 years)'
        pieOption.title.subtext = 'Neonates (under 28 days) vs Infants (1 month to under 1 year) vs Children (1 to under 5 years)'
        pieOption.series[0].name = 'Neonates (under 28 days) vs Infants (1 month to under 1 year) vs Children (1 to under 5 years)'
        pieOption.legend.data.push(`Neonates - under 28 days (${indicators['neonates'].value})`)
        pieOption.legend.data.push(`Infants - 1 month to under 1 year (${indicators['infants'].value})`)
        pieOption.legend.data.push(`Children - 1 to under 5 years (${indicators['children_under5'].value})`)
        pieOption.series[0].data.push({
          name: `Neonates - under 28 days (${indicators['neonates'].value})`,
          value: indicators['neonates'].value
        })
        pieOption.series[0].data.push({
          name: `Infants - 1 month to under 1 year (${indicators['infants'].value})`,
          value: indicators['infants'].value
        })
        pieOption.series[0].data.push({
          name: `Children - 1 to under 5 years (${indicators['children_under5'].value})`,
          value: indicators['children_under5'].value
        })
        this.chartOptions.push(pieOption)

        //male 20-24 vs female 20-24
        pieOption = this.createChartDefOpt()
        pieOption.title.text = 'Male vs Female (20-24 Years)'
        pieOption.title.subtext = 'Male vs Female (20-24 Years)'
        pieOption.series[0].name = 'Male vs Female (20-24 Years)'
        pieOption.legend.data.push(`Female (${indicators['female_youth_20_24'].value})`)
        pieOption.legend.data.push(`Male (${indicators['male_youth_20_24'].value})`)
        pieOption.series[0].data.push({
          name: `Female (${indicators['female_youth_20_24'].value})`,
          value: indicators['female_youth_20_24'].value
        })
        pieOption.series[0].data.push({
          name: `Male (${indicators['male_youth_20_24'].value})`,
          value: indicators['male_youth_20_24'].value
        })
        this.chartOptions.push(pieOption)
      })
    },
    getDataFromJSON (json, json_key) {
      let keys = Object.keys(json)
      if(json.hasOwnProperty(json_key)) {
        return json[json_key]
      } else {
        let key_found = keys.find((key) => {
          return key.endsWith('/' + json_key)
        })
        if(key_found) {
          return json[key_found]
        } else {
          return false
        }
      }
    }
  },
  computed: {
    startDateFormatted () {
      if (!this.startDate) {
        return null
      }
      const [year, month, day] = this.startDate.split('-')
      return `${day}/${month}/${year}`
    },
    endDateFormatted () {
      if (!this.endDate) {
        return null
      }
      const [year, month, day] = this.endDate.split('-')
      return `${day}/${month}/${year}`
    }
  },
  created() {
    this.generate()
  }
}
</script>
