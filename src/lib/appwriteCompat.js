// Backwards-compatible replacements for the two Appwrite helpers the UI used.
// Query objects are serialized and sent to the backend, which translates them
// into parameterized SQL. ID.unique() simply produces a UUID.

export const Query = {
  equal: (attribute, values) => ({
    method: "equal",
    attribute,
    values: Array.isArray(values) ? values : [values],
  }),
  notEqual: (attribute, value) => ({ method: "notEqual", attribute, values: [value] }),
  lessThan: (attribute, value) => ({ method: "lessThan", attribute, values: [value] }),
  greaterThan: (attribute, value) => ({ method: "greaterThan", attribute, values: [value] }),
  search: (attribute, value) => ({ method: "search", attribute, values: [value] }),
  contains: (attribute, values) => ({
    method: "contains",
    attribute,
    values: Array.isArray(values) ? values : [values],
  }),
  isNotNull: (attribute) => ({ method: "isNotNull", attribute }),
  isNull: (attribute) => ({ method: "isNull", attribute }),
  orderAsc: (attribute) => ({ method: "orderAsc", attribute }),
  orderDesc: (attribute) => ({ method: "orderDesc", attribute }),
  limit: (value) => ({ method: "limit", values: [value] }),
  offset: (value) => ({ method: "offset", values: [value] }),
};

export const ID = {
  unique: () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
};
