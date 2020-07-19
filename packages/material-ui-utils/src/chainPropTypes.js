// export default function chainPropTypes(propType1, propType2) {
//   if (process.env.NODE_ENV === 'production') {
//     return () => null;
//   }

//   return function validate(...args) {
//     return propType1(...args) || propType2(...args);
//   };
// }

export default function chainPropTypes(...types) {
  if (process.env.NODE_ENV === 'production') {
    return () => null;
  }

  return function validate(...args) {
    const errors = types.map((type) => type(...args));

    const someError = errors.some((element) => element !== null);
    // no errors? cool!
    if (!someError) return null;
    return someError;
  };
}
