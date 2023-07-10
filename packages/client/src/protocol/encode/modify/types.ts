enum ModifyArgType {
  SELVA_MODIFY_ARG_INVALID = '\0',
  /* Node object string field operations. */
  SELVA_MODIFY_ARG_DEFAULT_STRING = '2' /*!< Set a string value if unset. */,
  SELVA_MODIFY_ARG_STRING = '0' /*!< Value is a string. */,
  /* Node object numeric field operations. */
  SELVA_MODIFY_ARG_DEFAULT_LONGLONG = '8',
  SELVA_MODIFY_ARG_LONGLONG = '3' /*!< Value is a long long. */,
  SELVA_MODIFY_ARG_DEFAULT_DOUBLE = '9',
  SELVA_MODIFY_ARG_DOUBLE = 'A' /*!< Value is a double. */,
  SELVA_MODIFY_ARG_OP_INCREMENT = '4' /*!< Increment a long long value. */,
  SELVA_MODIFY_ARG_OP_INCREMENT_DOUBLE = 'B' /*!< Increment a double value. */,
  /* Node object set field operations. */
  SELVA_MODIFY_ARG_OP_SET = '5' /*!< Value is a struct SelvaModify_OpSet. */,
  /* Node object array field operations. */
  SELVA_MODIFY_ARG_OP_ARRAY_PUSH = 'D' /*!< Set a new empty SelvaObject at the end of an array */,
  SELVA_MODIFY_ARG_OP_ARRAY_INSERT = 'E' /*!< Set a new empty SelvaObject at the start of an array */,
  SELVA_MODIFY_ARG_OP_ARRAY_REMOVE = 'F' /*!< Remove item in specified index from array */,
  SELVA_MODIFY_ARG_OP_ARRAY_QUEUE_TRIM = 'H' /*!< Remove items from the end of the array to match given length */,
  /* HLL operations. */
  SELVA_MODIFY_ARG_OP_HLL = 'I',
  /* Node object operations. */
  SELVA_MODIFY_ARG_OP_DEL = '7' /*!< Delete field; value is a modifier. */,
  SELVA_MODIFY_ARG_OP_OBJ_META = 'C' /*!< Set object user metadata. */,
  /* Edge metadata ops. */
  SELVA_MODIFY_ARG_OP_EDGE_META = 'G' /*!< Modify edge field metadata. */,
  /* Other ops. */
  SELVA_MODIFY_ARG_STRING_ARRAY = '6' /*!< Array of C-strings. */,
}
