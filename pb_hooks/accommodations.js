// Accommodations a teacher set for one student, e.g. { "extraTimeMinutes": 5 }.
// They follow the student into every quiz they sit.
module.exports = function accommodations(student) {
  let saved = {};
  try {
    // accommodations is a JSON field; getString returns its serialized text.
    saved = JSON.parse(student.getString("accommodations") || "{}") || {};
  } catch (_) {}

  const extraTime = Math.round(Number(saved.extraTimeMinutes));
  return {
    extraTimeMinutes: extraTime > 0 ? Math.min(60, extraTime) : 0,
  };
};
