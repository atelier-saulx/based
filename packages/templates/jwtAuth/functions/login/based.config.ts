export default {
  name: 'login',
  // functions of type `function` are non observable
  // so they run synchronous.
  // They are called with the based.call() method
  type: 'function',
  // public property of a function
  public: true,
}
