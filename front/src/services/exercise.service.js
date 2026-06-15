import API from "../api/api";

export function getExerciseRecords(workoutId) {
  return API.get(`/exercise/workout/${workoutId}`);
}

export function addExerciseRecord(data) {
  return API.post("/exercise", data);
}