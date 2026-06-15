import API from '../api/api';

export async function getWorkouts() {
  try {
    const response = await API.get('/workouts');
    return response.data.workouts;
  } catch {
    return [];
  }
}

export async function getWorkout(id) {
  try {
    const response = await API.get(`/workouts/${id}`);
    return response.data.workout;
  } catch {
    return null;
  }
}

export async function createWorkout(workout) {
  try {
    const response = await API.post('/workouts', workout);
    return response.data.workout;
  } catch {
    return null;
  }
}
