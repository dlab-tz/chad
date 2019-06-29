const backendServer = process.env.VUE_APP_BACKEND_SERVER
import axios from 'axios'
export const generalMixin = {
  data() {
    return {
      lastLocationType: 'village'
    }
  },
  methods: {
    getLocation(item) {
      let query
      if (!item.typeTag) {
        query = '?type=&checkChild=' + false + '&lastLocationType=' + this.lastLocationType
      } else {
        query = '?type=' + item.typeTag + '&checkChild=' + false + '&id=' + item.id + '&lastLocationType=' + this.lastLocationType
      }
      axios.get(backendServer + '/locationTree' + query).then((data) => {
        item.children.push(...data.data)
        return item;
      })
    }
  }
}
