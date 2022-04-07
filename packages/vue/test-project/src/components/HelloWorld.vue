<template>
  <div class="hello">
    <h6>{{ msg }}</h6>
  </div>
</template>

<script>
export default {
  name: 'HelloWorld',
  props: {
    msg: [String, Number, Object],
  },
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}
</style>
