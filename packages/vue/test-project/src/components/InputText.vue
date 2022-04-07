<template>
  <div class="container">
    <input
      type="text"
      class="input"
      :value="value"
      :placeholder="placeHolder"
      v-on="listeners"
    />
    <button class="button" @click="emitMessage">Send</button>
  </div>
</template>

<script>
export default {
  props: {
    value: {
      type: String,
      default: '',
    },
    placeHolder: {
      type: String,
      default: '',
    },
  },
}
</script>

<style scoped>
.container {
  width: 100%;
  display: flex;
  flex-direction: row;
}

.input {
  width: 100%;

  padding: 8px 10px;
  border: 1px solid blue;
}

.button {
  transition-duration: 0.2s;
  background-color: blue; /* Green */
  border: none;
  color: white;
  padding: 8px 10px;
  text-align: center;
  text-decoration: none;
  font-size: 16px;
  margin: 4px 2px;
  cursor: pointer;
}

.button:hover {
  background-color: darkblue;
}
</style>
